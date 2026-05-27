from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.employee import EmployeeType, UserRole


class DepartmentBriefSchema(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class EmployeeCreateSchema(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    job_title: Optional[str] = None
    role: UserRole = UserRole.employee
    employee_type: EmployeeType = EmployeeType.FULL_TIME
    department_id: Optional[UUID] = None
    join_date: Optional[date] = None
    base_salary: Optional[Decimal] = None


class EmployeeUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    role: Optional[UserRole] = None
    employee_type: Optional[EmployeeType] = None
    department_id: Optional[UUID] = None
    join_date: Optional[date] = None
    base_salary: Optional[Decimal] = None


class EmployeeSelfUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class EmployeeResponseSchema(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    phone: Optional[str]
    job_title: Optional[str]
    role: UserRole
    employee_type: EmployeeType
    department_id: Optional[UUID]
    department: Optional[DepartmentBriefSchema]
    join_date: Optional[date]
    base_salary: Optional[Decimal]
    face_enrolled: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
