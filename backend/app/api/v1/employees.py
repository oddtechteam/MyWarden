from fastapi import APIRouter

router = APIRouter()

# TODO: implement in Phase 1 Part 3 — employee CRUD + face enrollment trigger


@router.get("/")
async def list_employees():
    pass


@router.post("/")
async def create_employee():
    pass


@router.get("/{employee_id}")
async def get_employee(employee_id: str):
    pass


@router.put("/{employee_id}")
async def update_employee(employee_id: str):
    pass


@router.delete("/{employee_id}")
async def deactivate_employee(employee_id: str):
    pass


@router.post("/{employee_id}/enroll-face")
async def enroll_face(employee_id: str):
    # TODO: implement in Phase 1 Part 4 — face enrollment
    pass
