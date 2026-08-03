"""
Targeted diagnostic for the "Fabry Disease not found / Diabetes has no
symptoms" issue.

Drop this into backend/scripts/ and run from backend/:
    python -m scripts.diagnose_disease_data

It answers three questions directly, with evidence, instead of guessing:
  1. Which Supabase project is this backend actually connected to?
  2. Is "Fabry Disease" really absent from that project's `cases` table,
     or does it just not match by name?
  3. For a disease that *does* return a case count (e.g. Type 1 Diabetes),
     what does `symptoms` / `age_range` actually contain on those rows —
     null, empty array, or a shape extract_names() can't parse?
"""

import os
import sys

# Allows running as `python -m scripts.diagnose_disease_data` from backend/
sys.path.insert(0, os.getcwd())

# NOTE: app/db/supabase_client.py reads os.environ directly and never calls
# load_dotenv() itself -- only app/core/config.py does, on import. Since this
# script doesn't import app.core.config, .env would silently never get
# loaded without this explicit call.
from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.tools import data_access as da  # noqa: E402


def mask(url: str) -> str:
    if not url:
        return "(not set)"
    # show enough to distinguish projects without printing the whole thing
    return url.replace("https://", "").split(".")[0]


def main():
    print("== Which project is this backend actually pointed at? ==")
    print(f"  SUPABASE_URL project ref: {mask(os.environ.get('SUPABASE_URL'))}")
    print(f"  QDRANT_URL:               {mask(os.environ.get('QDRANT_URL'))}")
    print(
        "  -> Compare this to whatever project ref each of you (ruvan/krithi/darsh) "
        "used when you loaded your batch. If any of you pointed at a different "
        "Supabase project, that batch's diseases won't show up here at all.\n"
    )

    print("== Full distinct disease list currently in `cases.disease` ==")
    names = da.get_all_disease_names(force_refresh=True)
    print(f"  {len(names)} distinct disease values:")
    for n in names:
        print(f"    - {n!r}")
    fabry_present = any("fabry" in n.lower() for n in names)
    print(f"\n  Any name containing 'fabry'? {fabry_present}")
    if not fabry_present:
        print(
            "  -> Fabry Disease genuinely is not in this database/project. "
            "The tool is reporting correctly; the fix is loading it into "
            "THIS project, not a code fix."
        )
    print()

    print("== Resolving 'Fabry Disease' the way the agent does ==")
    resolved = da.resolve_disease_name("Fabry Disease")
    print(f"  resolve_disease_name('Fabry Disease') -> {resolved!r}")
    print()

    for disease in ("Type 1 Diabetes", "Type 2 Diabetes"):
        print(f"== Raw row inspection: {disease} ==")
        resolved = da.resolve_disease_name(disease)
        if not resolved:
            print(f"  Could not resolve '{disease}' at all.")
            continue
        cases = da.fetch_cases_for_disease(resolved)
        print(f"  {len(cases)} rows found for resolved name {resolved!r}")
        for i, c in enumerate(cases[:3]):
            print(f"  -- row {i} --")
            print(f"     id: {c.get('id')}")
            print(f"     symptoms (raw):  {c.get('symptoms')!r}")
            print(f"     age_range (raw): {c.get('age_range')!r}")
            print(f"     outcome (raw):   {c.get('outcome')!r}")
            parsed = da.case_symptoms(c)
            print(f"     symptoms parsed by case_symptoms(): {parsed}")
        print()

    print("== Summary ==")
    print(
        "  If the disease list above is missing entries you know you loaded, "
        "or the project ref doesn't match what you used to load them, the "
        "fix is: point everyone at the same SUPABASE_URL, or copy the data "
        "into it. If Fabry IS in the list above but still resolves to None, "
        "that's a genuine resolve_disease_name bug worth reporting back with "
        "this output. If Diabetes rows show symptoms as null/[] above, that's "
        "confirmation the loader for that batch never wrote symptoms — not a "
        "tool bug."
    )


if __name__ == "__main__":
    main()