from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, employees, attendance, payroll, leave, reports

app = FastAPI(
    title="MyWarden API",
    version="1.0.0",
    description="Employee Management System API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["employees"])
app.include_router(attendance.router, prefix="/api/v1/attendance-logs", tags=["attendance"])
app.include_router(payroll.router, prefix="/api/v1/payroll-runs", tags=["payroll"])
app.include_router(leave.router, prefix="/api/v1/leave", tags=["leave"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
