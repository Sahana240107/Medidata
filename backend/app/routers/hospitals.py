"""
Hospitals / Nodes router — Multi-Node Simulator.

GET /hospitals              -> list every node in the network + local case count
GET /hospitals/{id}         -> a single node's detail
GET /hospitals/{id}/cases   -> that node's local dataset only (never cross-node)
"""

from typing import List

from fastapi import APIRouter, Depends, Query

from app.deps.auth import get_current_user
from app.schemas.hospital import HospitalNode
from app.services import hospital_service

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


@router.get("", response_model=List[HospitalNode])
async def list_nodes(user: dict = Depends(get_current_user)):
    return hospital_service.list_hospitals()


@router.get("/{hospital_id}", response_model=HospitalNode)
async def get_node(hospital_id: str, user: dict = Depends(get_current_user)):
    return hospital_service.get_hospital(hospital_id)


@router.get("/{hospital_id}/cases")
async def get_node_cases(
    hospital_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    return hospital_service.get_hospital_cases(hospital_id, limit=limit, offset=offset)