"""
Backs frontend/lib/api/dataset.js and DatasetDownloadPanel.

GET /research/datasets/catalog  -> diseases + domains + locations, all with real counts
GET /research/datasets/summary  -> live totals for the current filter selection
GET /research/datasets/export   -> CSV or XLSX download of the filtered case set

Supports filtering/grouping by disease, domain (e.g. "Oncology" = every
cancer subtype), location (country), gender, and age range — one value per
dimension at a time (e.g. domain=Oncology + gender=Female), which is
combined with AND logic.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.deps.auth import get_current_user
from app.services import dataset_service

router = APIRouter(prefix="/research/datasets", tags=["research-datasets"])


def _filters(
    disease: str | None,
    domain: str | None,
    location: str | None,
    gender: str | None,
    age_range: str | None,
) -> dict:
    return {
        "diseases": [disease] if disease else [],
        "domains": [domain] if domain else [],
        "countries": [location] if location else [],
        "sexes": [gender] if gender else [],
        "age_ranges": [age_range] if age_range else [],
    }


@router.get("/catalog")
async def get_catalog(user: dict = Depends(get_current_user)):
    return dataset_service.get_catalog()


@router.get("/summary")
async def get_summary(
    disease: str | None = Query(None),
    domain: str | None = Query(None),
    location: str | None = Query(None),
    gender: str | None = Query(None),
    age_range: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    return dataset_service.get_summary(_filters(disease, domain, location, gender, age_range))


@router.get("/export")
async def export_dataset(
    disease: str | None = Query(None),
    domain: str | None = Query(None),
    location: str | None = Query(None),
    gender: str | None = Query(None),
    age_range: str | None = Query(None),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    user: dict = Depends(get_current_user),
):
    rows = dataset_service.get_export_rows(_filters(disease, domain, location, gender, age_range))
    if not rows:
        raise HTTPException(status_code=404, detail="No cases match the selected filters.")

    if format == "xlsx":
        content = dataset_service.rows_to_xlsx_bytes(rows)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "medidata_dataset.xlsx"
    else:
        content = dataset_service.rows_to_csv_bytes(rows)
        media_type = "text/csv"
        filename = "medidata_dataset.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post("/reload-schema-cache")
async def reload_schema_cache(user: dict = Depends(get_current_user)):
    dataset_service.reload_schema_cache()
    return {"status": "ok", "message": "PostgREST schema cache reload triggered."}