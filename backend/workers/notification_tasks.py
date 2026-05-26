# TODO: implement in Phase 4
from workers.celery_app import celery_app


@celery_app.task
def send_notification(employee_id: str, message: str) -> None:
    pass
