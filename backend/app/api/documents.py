from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user_id

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    allowed_types = ["application/pdf", "text/plain", "text/csv"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, TXT, and CSV files are supported"
        )

    contents = await file.read()
    file_size_kb = len(contents) / 1024

    return {
        "filename": file.filename,
        "size_kb": round(file_size_kb, 1),
        "content_type": file.content_type,
        "status": "received",
        "message": f"{file.filename} received successfully."
    }


@router.get("/")
def list_documents(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return {
        "documents": [],
        "message": "Document storage connects to S3 in production deployment"
    }