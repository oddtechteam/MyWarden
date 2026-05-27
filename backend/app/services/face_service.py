"""
Face enrollment and matching using DeepFace (Facenet512, 512-dim embeddings).

Enrollment flow:
  1. Receive 8-10 JPEG frames from frontend
  2. Extract 512-dim embedding per frame via DeepFace (runs in thread pool)
  3. Average embeddings → L2-normalise → store as employees.face_embedding (pgvector)
  4. Raw frames already uploaded to S3/MinIO before this is called

Match flow (Phase 2):
  1. Receive single frame from kiosk
  2. Extract embedding
  3. Query pgvector for cosine similarity >= FACE_MATCH_THRESHOLD (0.80)
  4. Return matched employee or trigger OTP fallback after 3 failures
"""
import asyncio
import logging
import os
import tempfile
from typing import Optional

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


async def extract_embedding(image_bytes: bytes) -> Optional[list[float]]:
    """
    Extract a 512-dim Facenet512 embedding from raw JPEG bytes.
    DeepFace is synchronous/CPU-bound so we offload it to a thread.
    Returns None if no face is detected or an error occurs.
    """
    def _run() -> Optional[list[float]]:
        from deepface import DeepFace  # lazy import — model loads on first call

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
                f.write(image_bytes)
                tmp_path = f.name

            results = DeepFace.represent(
                img_path=tmp_path,
                model_name=settings.DEEPFACE_MODEL,
                enforce_detection=True,
                detector_backend="opencv",
            )
            return results[0]["embedding"]
        except Exception as exc:
            logger.debug("DeepFace extraction failed for frame: %s", exc)
            return None
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return await asyncio.to_thread(_run)


def average_embeddings(embeddings: list[list[float]]) -> list[float]:
    """Average a list of 512-dim embeddings and L2-normalise the result."""
    arr = np.array(embeddings, dtype=np.float32)
    mean = arr.mean(axis=0)
    norm = float(np.linalg.norm(mean))
    if norm > 0:
        mean = mean / norm
    return mean.tolist()


async def match_embedding(
    probe: list[float],
    gallery: list[tuple[str, list[float]]],
) -> Optional[str]:
    """
    Phase 2 helper — cosine similarity search over a small in-memory gallery.
    For production use pgvector's <=> operator instead.

    probe   : 512-dim embedding of the face to identify
    gallery : list of (employee_id, embedding) pairs
    Returns the employee_id of the best match above FACE_MATCH_THRESHOLD, else None.
    """
    def _run() -> Optional[str]:
        probe_arr = np.array(probe, dtype=np.float32)
        best_id, best_sim = None, -1.0
        for emp_id, emb in gallery:
            emb_arr = np.array(emb, dtype=np.float32)
            sim = float(np.dot(probe_arr, emb_arr))  # both are L2-normalised
            if sim > best_sim:
                best_sim = sim
                best_id = emp_id
        if best_sim >= settings.FACE_MATCH_THRESHOLD:
            return best_id
        return None

    return await asyncio.to_thread(_run)
