"""
router.py

Exposes the falsification-engine endpoints:

    POST   /api/falsification/dataset/upload   uploaded CSV/XLSX -> dataset_id + preview
    GET    /api/falsification/dataset/{id}      cached dataset metadata + preview
    DELETE /api/falsification/dataset/{id}      drop an uploaded dataset
    POST   /api/falsification/run               case ID lists -> robustness check results
    GET    /api/falsification/checks/{id}       cached falsification result

Result caching here is a simple in-memory dict, which is fine for a
beginner-scope build — swap for Redis/Supabase if this needs to survive a
process restart. The data source is either an uploaded dataset (pass its
`dataset_id` in the run filters — see dataset_store.py) or, if none is given,
`get_case_source()`, a stub that must be pointed at your real Supabase client
at wiring time (see the docstring on that function).
"""
from __future__ import annotations

from datetime import datetime
from typing import Callable, Iterable

from fastapi import APIRouter, File, HTTPException, UploadFile

from .dataset_store import (
    DatasetParseError,
    delete_dataset,
    get_dataset_cases,
    get_dataset_meta,
    parse_uploaded_file,
    preview_rows,
    store_dataset,
)
from .local_cohort_builder import CaseRow
from .schemas import CohortFilters, DatasetUploadResponse, FalsificationRunResult
from .service import run_falsification

router = APIRouter(prefix="/api/falsification", tags=["falsification-engine"])

_RESULT_CACHE: dict[str, FalsificationRunResult] = {}


def get_case_source(dataset_id: str | None = None) -> Callable[[], Iterable[CaseRow]]:
    """Returns a zero-arg callable yielding CaseRow objects.

    If `dataset_id` is given, serves cases from that previously-uploaded
    dataset (see POST /dataset/upload). Otherwise falls back to the live
    source, which is a STUB — wire this to your real Supabase client, e.g.:

        def get_case_source(dataset_id=None):
            if dataset_id:
                ... (unchanged) ...
            def _load():
                resp = supabase.table("cases").select(
                    "id,disease,domain,hospital_id,country,sex,age_range,"
                    "medications,outcome,created_at"
                ).execute()
                return [CaseRow(**row) for row in resp.data]
            return _load

    Left unimplemented for the live path on purpose — this router file has
    zero real network/DB code so it can be imported and unit-tested without a
    live Supabase connection. Uploading a dataset and passing its id sidesteps
    this entirely.
    """
    if dataset_id:
        def _load_uploaded():
            cases = get_dataset_cases(dataset_id)
            if cases is None:
                raise HTTPException(status_code=404, detail=f"no uploaded dataset for dataset_id={dataset_id}")
            return cases
        return _load_uploaded

    raise NotImplementedError(
        "No dataset_id was supplied and get_case_source() is not wired to your Supabase client. "
        "Either upload a dataset via POST /api/falsification/dataset/upload and pass its dataset_id, "
        "or wire get_case_source() per its docstring."
    )


@router.post("/dataset/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetUploadResponse:
    content = await file.read()
    try:
        cases, columns = parse_uploaded_file(file.filename or "upload.csv", content)
    except DatasetParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    dataset_id = store_dataset(file.filename or "upload.csv", cases, columns)
    meta = get_dataset_meta(dataset_id)
    return DatasetUploadResponse(
        dataset_id=dataset_id,
        filename=meta["filename"],
        row_count=meta["row_count"],
        columns=meta["columns"],
        uploaded_at=datetime.fromisoformat(meta["uploaded_at"]),
        preview=preview_rows(dataset_id),
    )


@router.get("/dataset/{dataset_id}", response_model=DatasetUploadResponse)
def get_dataset(dataset_id: str) -> DatasetUploadResponse:
    meta = get_dataset_meta(dataset_id)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"no uploaded dataset for dataset_id={dataset_id}")
    return DatasetUploadResponse(
        dataset_id=dataset_id,
        filename=meta["filename"],
        row_count=meta["row_count"],
        columns=meta["columns"],
        uploaded_at=datetime.fromisoformat(meta["uploaded_at"]),
        preview=preview_rows(dataset_id),
    )


@router.delete("/dataset/{dataset_id}")
def remove_dataset(dataset_id: str) -> dict:
    if not delete_dataset(dataset_id):
        raise HTTPException(status_code=404, detail=f"no uploaded dataset for dataset_id={dataset_id}")
    return {"deleted": True, "dataset_id": dataset_id}


@router.post("/run", response_model=FalsificationRunResult)
def run(filters: CohortFilters) -> FalsificationRunResult:
    try:
        result = run_falsification(filters, case_source=get_case_source(filters.dataset_id))
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    _RESULT_CACHE[result.run_id] = result
    return result


@router.get("/checks/{run_id}", response_model=FalsificationRunResult)
def get_cached(run_id: str) -> FalsificationRunResult:
    result = _RESULT_CACHE.get(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no cached falsification result for run_id={run_id}")
    return result