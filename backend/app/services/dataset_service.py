"""
Powers the Research > Dataset page: real disease/domain/location groupings,
filter-aware summary stats, and CSV/Excel export — all computed from the
live Qdrant case_fingerprints collection (not Supabase). Qdrant's payload
already carries a clean `disease` value and richer structured fields
(icd_codes, diagnosis_icd, symptom_names, lab_markers) than the raw
Supabase `cases` row does, so it's the better source for this feature.

Hospital NAMES (for readable export columns) still come from a small
Supabase lookup — Qdrant only stores hospital_id, not the hospital's name.
That's the one place this still touches Supabase.
"""

import csv
import io
import logging
from collections import defaultdict

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.disease_domains import classify_domain
from app.db.qdrant_client import get_qdrant_client
from app.db.supabase_client import get_supabase_admin

logger = logging.getLogger("medidata.feed_stats")

SCROLL_PAGE_SIZE = 500


def _fetch_all_case_payloads() -> list[dict]:
    """Every point's payload in the case_fingerprints Qdrant collection."""
    settings = get_settings()
    client = get_qdrant_client()

    payloads: list[dict] = []
    next_offset = None
    page_num = 0

    while True:
        try:
            points, next_offset = client.scroll(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                limit=SCROLL_PAGE_SIZE,
                offset=next_offset,
                with_payload=True,
                with_vectors=False,
            )
        except Exception as e:
            logger.error("[dataset_service] Qdrant scroll FAILED: %r", e)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch cases from Qdrant: {e}")

        page_num += 1
        logger.info("[dataset_service] Qdrant page %d -> got %d points", page_num, len(points))
        payloads.extend(p.payload or {} for p in points)

        if next_offset is None:
            break

    logger.info("[dataset_service] TOTAL Qdrant payloads fetched: %d", len(payloads))
    return payloads


def _hospital_names(hospital_ids: set[str]) -> dict[str, str]:
    """Small Supabase lookup — Qdrant only has hospital_id, not the name."""
    if not hospital_ids:
        return {}
    supabase = get_supabase_admin()
    resp = supabase.table("hospitals").select("id,name").in_("id", list(hospital_ids)).execute()
    return {h["id"]: h["name"] for h in (resp.data or [])}


def _apply_filters(rows: list[dict], filters: dict) -> list[dict]:
    diseases = set(filters.get("diseases") or [])
    domains = set(filters.get("domains") or [])
    countries = set(filters.get("countries") or [])
    sexes = set(filters.get("sexes") or [])
    age_ranges = set(filters.get("age_ranges") or [])

    disease_or_domain_active = bool(diseases or domains)

    def matches(row: dict) -> bool:
        if disease_or_domain_active:
            row_disease = row.get("disease") or "Unclassified"
            row_domain = classify_domain(row.get("disease"))
            if row_disease not in diseases and row_domain not in domains:
                return False
        if countries and row.get("country") not in countries:
            return False
        if sexes and row.get("sex") not in sexes:
            return False
        if age_ranges and row.get("age_range") not in age_ranges:
            return False
        return True

    return [r for r in rows if matches(r)]


def _summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"total_cases": 0, "institutions": 0, "countries": 0, "date_range": None}
    hospital_ids = {r["hospital_id"] for r in rows if r.get("hospital_id")}
    countries = {r["country"] for r in rows if r.get("country")}
    return {
        "total_cases": len(rows),
        "institutions": len(hospital_ids),
        "countries": len(countries),
        # Qdrant's payload doesn't carry a submission timestamp (unlike the
        # Supabase `cases.created_at` column), so there's nothing to compute
        # a date range from here. Showing None -> renders as "—" in the UI.
        "date_range": None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Facets — full disease / domain / location breakdown for the picker UI
# ─────────────────────────────────────────────────────────────────────────────

def get_facets() -> dict:
    rows = _fetch_all_case_payloads()

    disease_groups: dict[str, dict] = defaultdict(lambda: {"case_count": 0, "hospital_ids": set(), "countries": set()})
    domain_groups: dict[str, dict] = defaultdict(lambda: {"case_count": 0, "hospital_ids": set(), "countries": set(), "diseases": set()})
    country_groups: dict[str, dict] = defaultdict(lambda: {"case_count": 0, "hospital_ids": set(), "diseases": set()})
    sexes: set[str] = set()
    age_ranges: set[str] = set()

    for r in rows:
        disease = r.get("disease") or "Unclassified"
        domain = classify_domain(r.get("disease"))
        country = r.get("country") or "Unknown"
        hospital_id = r.get("hospital_id")

        dg = disease_groups[disease]
        dg["case_count"] += 1
        if hospital_id: dg["hospital_ids"].add(hospital_id)
        if country: dg["countries"].add(country)

        dom = domain_groups[domain]
        dom["case_count"] += 1
        if hospital_id: dom["hospital_ids"].add(hospital_id)
        if country: dom["countries"].add(country)
        dom["diseases"].add(disease)

        cg = country_groups[country]
        cg["case_count"] += 1
        if hospital_id: cg["hospital_ids"].add(hospital_id)
        cg["diseases"].add(disease)

        if r.get("sex"): sexes.add(r["sex"])
        if r.get("age_range"): age_ranges.add(r["age_range"])

    diseases_out = sorted(
        [
            {"name": name, "domain": classify_domain(None if name == "Unclassified" else name),
             "case_count": g["case_count"], "hospital_count": len(g["hospital_ids"]), "country_count": len(g["countries"])}
            for name, g in disease_groups.items()
        ],
        key=lambda x: -x["case_count"],
    )
    domains_out = sorted(
        [
            {"name": name, "case_count": g["case_count"], "hospital_count": len(g["hospital_ids"]),
             "country_count": len(g["countries"]), "disease_count": len(g["diseases"])}
            for name, g in domain_groups.items()
        ],
        key=lambda x: -x["case_count"],
    )
    countries_out = sorted(
        [
            {"name": name, "case_count": g["case_count"], "hospital_count": len(g["hospital_ids"]), "disease_count": len(g["diseases"])}
            for name, g in country_groups.items()
        ],
        key=lambda x: -x["case_count"],
    )

    result = {
        "diseases": diseases_out,
        "domains": domains_out,
        "countries": countries_out,
        "sexes": sorted(sexes),
        "age_ranges": sorted(age_ranges),
        "summary": _summarize(rows),
    }
    logger.info(
        "[dataset_service] get_facets() -> %d disease groups, %d domain groups, %d country groups, summary=%s",
        len(diseases_out), len(domains_out), len(countries_out), result["summary"],
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Filtered summary — live counts as the user toggles selections
# ─────────────────────────────────────────────────────────────────────────────

def get_summary(filters: dict) -> dict:
    rows = _fetch_all_case_payloads()
    filtered = _apply_filters(rows, filters)
    return _summarize(filtered)


# ─────────────────────────────────────────────────────────────────────────────
# Export — filtered case rows as CSV or XLSX bytes, using Qdrant's richer
# structured fields (icd_codes, diagnosis_icd) that Supabase's raw jsonb
# blobs didn't cleanly expose.
# ─────────────────────────────────────────────────────────────────────────────

EXPORT_COLUMNS = [
    "case_id", "disease", "domain", "diagnosis_icd", "hospital", "country", "sex", "age_range",
    "symptom_names", "icd_codes", "lab_markers", "medications", "procedures",
    "outcome", "status", "week_admitted",
]


def _flatten(value) -> str:
    if not value:
        return ""
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value)


def get_export_rows(filters: dict) -> list[dict]:
    rows = _fetch_all_case_payloads()
    filtered = _apply_filters(rows, filters)

    hospital_ids = {r["hospital_id"] for r in filtered if r.get("hospital_id")}
    hospital_names = _hospital_names(hospital_ids)

    out = []
    for r in filtered:
        out.append({
            "case_id": r.get("case_id"),
            "disease": r.get("disease") or "Unclassified",
            "domain": classify_domain(r.get("disease")),
            "diagnosis_icd": r.get("diagnosis_icd") or "",
            "hospital": hospital_names.get(r.get("hospital_id"), r.get("hospital_id") or ""),
            "country": r.get("country") or "",
            "sex": r.get("sex") or "",
            "age_range": r.get("age_range") or "",
            "symptom_names": _flatten(r.get("symptom_names")),
            "icd_codes": _flatten(r.get("icd_codes")),
            "lab_markers": _flatten(r.get("lab_markers")),
            "medications": _flatten(r.get("medications")),
            "procedures": _flatten(r.get("procedures")),
            "outcome": r.get("outcome") or "",
            "status": r.get("status") or "",
            "week_admitted": r.get("week_admitted") if r.get("week_admitted") is not None else "",
        })
    return out


def rows_to_csv_bytes(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8-sig")


def rows_to_xlsx_bytes(rows: list[dict]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "Dataset Export"

    header_fill = PatternFill(start_color="5C6BC0", end_color="5C6BC0", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    for col_idx, col_name in enumerate(EXPORT_COLUMNS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name.replace("_", " ").title())
        cell.fill = header_fill
        cell.font = header_font

    for row_idx, row in enumerate(rows, start=2):
        for col_idx, col_name in enumerate(EXPORT_COLUMNS, start=1):
            ws.cell(row=row_idx, column=col_idx, value=row.get(col_name, ""))

    for col_idx, col_name in enumerate(EXPORT_COLUMNS, start=1):
        width = max(14, min(40, len(col_name) + 4))
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def get_catalog() -> dict:
    """
    Everything DatasetDownloadPanel needs in one call: every disease, domain,
    and location grouping with real counts (most common first), plus the
    gender and age-range options that actually exist in your data.
    """
    facets = get_facets()
    return {
        "diseases": [
            {"disease": d["name"], "domain": d["domain"], "case_count": d["case_count"], "institution_count": d["hospital_count"]}
            for d in facets["diseases"]
        ],
        "domains": [
            {"domain": d["name"], "case_count": d["case_count"], "institution_count": d["hospital_count"], "disease_count": d["disease_count"]}
            for d in facets["domains"]
        ],
        "locations": [
            {"country": c["name"], "case_count": c["case_count"], "institution_count": c["hospital_count"], "disease_count": c["disease_count"]}
            for c in facets["countries"]
        ],
        "genders": facets["sexes"],
        "age_ranges": facets["age_ranges"],
        "summary": facets["summary"],
    }


def reload_schema_cache() -> None:
    """Kept for the existing /reload-schema-cache endpoint. Not relevant to
    Qdrant (no schema cache to stale), but harmless to leave callable —
    reloads Postgres/PostgREST in case other parts of the app still need it."""
    supabase = get_supabase_admin()
    try:
        supabase.rpc("reload_postgrest_schema", {}).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to reload schema cache: {e}")