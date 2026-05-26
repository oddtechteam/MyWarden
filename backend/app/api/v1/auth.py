from fastapi import APIRouter

router = APIRouter()

# TODO: implement in Phase 1 Part 2 — login, logout, refresh token


@router.post("/login")
async def login():
    pass


@router.post("/logout")
async def logout():
    pass


@router.post("/refresh")
async def refresh_token():
    pass
