# Celery worker — added in Phase 3. Phase 1 & 2 use FastAPI BackgroundTasks instead.
from celery import Celery

from app.config import settings

celery_app = Celery(
    "mywarden",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["workers.payroll_tasks", "workers.notification_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
