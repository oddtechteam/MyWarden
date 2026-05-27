from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "mywarden-enrollments"
    S3_ENDPOINT_URL: str = ""

    # "local" saves files to LOCAL_STORAGE_PATH; "s3" uses S3/MinIO
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: str = "local_storage"

    DEEPFACE_MODEL: str = "Facenet512"
    FACE_MATCH_THRESHOLD: float = 0.80

    # SMTP — set SMTP_ENABLED=true in production
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_TLS: bool = True          # True = STARTTLS on port 587; False = SSL on port 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""            # display name + address, e.g. "MyWarden <no-reply@company.com>"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
