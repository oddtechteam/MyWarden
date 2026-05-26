from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class DepartmentCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DepartmentResponseSchema(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}
