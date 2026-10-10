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
    """
    Upload a financial document.
    The file is received and stored for evidence use.
    In production this goes to S3 then through the RAG pipeline.
    For the demo it confirms receipt and returns metadata.
    """
    allowed_types = ["application/pdf", "text/plain", "text/csv"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, TXT, and CSV files are supported"
        )

    contents = await file.read()
    file_size_kb = len(contents) / 1024

    # In production: save to S3, trigger ingestion worker
    # For demo: confirm receipt
    return {
        "filename": file.name,
        "size_kb": round(file_size_kb, 1),
        "content_type": file.content_type,
        "status": "received",
        "message": f"{file.name} received successfully. In production this would be processed through the RAG pipeline and made available as evidence in your queries."
    }


@router.get("/")
def list_documents(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """List uploaded documents for the current user."""
    return {
        "documents": [],
        "message": "Document storage connects to S3 in production deployment"
    }