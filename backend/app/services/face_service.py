# Face enrollment and matching using DeepFace (Facenet512, 512-dim embeddings)
# TODO: implement in Phase 1 Part 4
#
# Enrollment flow:
#   1. Receive 8-10 base64 frames from frontend
#   2. Extract 512-dim embedding per frame via DeepFace
#   3. Average embeddings → store mean vector in employees.face_embedding (pgvector)
#   4. Upload raw frames to S3 under enrollments/{employee_id}/{timestamp}.jpg
#
# Match flow (Phase 2):
#   1. Receive single frame from kiosk
#   2. Extract embedding
#   3. Query pgvector for cosine similarity >= FACE_MATCH_THRESHOLD (0.80)
#   4. Return matched employee or trigger OTP fallback after 3 failures
