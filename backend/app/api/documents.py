import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user_id
from app.services.document_service import (
    MAX_UPLOAD_BYTES,
    DocumentError,
    save_document,
    list_documents,
    delete_document,
)

router = APIRouter(prefix="/documents", tags=["documents"])


def _document_out(doc) -> dict:
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "content_type": doc.content_type,
        "size_kb": round(doc.size_bytes / 1024, 1),
        "characters": len(doc.text_content),
        "created_at": str(doc.created_at),
    }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Read at most one byte past the limit so oversized files are rejected
    # without loading them fully into memory
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        doc = save_document(db, user_id, file.filename or "document", file.content_type, data)
    except DocumentError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {**_document_out(doc), "status": "stored", "message": f"{doc.filename} uploaded successfully."}


@router.get("/")
def get_documents(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    return {"documents": [_document_out(d) for d in list_documents(db, user_id)]}


@router.delete("/{document_id}")
def remove_document(
    document_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    try:
        uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found")
    if not delete_document(db, user_id, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}
