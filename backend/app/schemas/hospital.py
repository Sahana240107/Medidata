"""
Hospital / Node schemas — the Multi-Node Simulator's node registry.
"""

from typing import Optional

from pydantic import BaseModel


class HospitalNode(BaseModel):
    id: str
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    case_count: int = 0