# TODO: implement in Phase 3
from workers.celery_app import celery_app


@celery_app.task
def run_payroll(payroll_run_id: str) -> None:
    pass
