from typing import Optional

from pydantic import BaseModel


class DiseaseGroup(BaseModel):
    name: str
    domain: str
    case_count: int
    hospital_count: int
    country_count: int


class DomainGroup(BaseModel):
    name: str
    case_count: int
    hospital_count: int
    country_count: int
    disease_count: int


class CountryGroup(BaseModel):
    name: str
    case_count: int
    hospital_count: int
    disease_count: int


class DatasetSummary(BaseModel):
    total_cases: int
    institutions: int
    countries: int
    date_range: Optional[str] = None


class DatasetFacets(BaseModel):
    diseases: list[DiseaseGroup]
    domains: list[DomainGroup]
    countries: list[CountryGroup]
    sexes: list[str]
    age_ranges: list[str]
    summary: DatasetSummary


class DatasetFilters(BaseModel):
    diseases: list[str] = []
    domains: list[str] = []
    countries: list[str] = []
    sexes: list[str] = []
    age_ranges: list[str] = []
    date_from: Optional[str] = None  # ISO date, e.g. "2022-01-01"
    date_to: Optional[str] = None