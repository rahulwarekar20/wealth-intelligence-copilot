"""
User documents: validates uploads, extracts text from PDF/TXT/CSV, stores it,
and finds passages that mention a company so the Evidence Agent can cite them.
"""

import io
import re
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Document

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_STORED_CHARS = 500_000

# Browsers/OSes report CSV and TXT with several MIME types (Windows often sends
# application/vnd.ms-excel for .csv), so the file extension is checked too.
ALLOWED_EXTENSIONS = {
    ".pdf": {"application/pdf", "application/x-pdf", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".csv": {"text/csv", "text/plain", "application/csv", "application/vnd.ms-excel",
             "text/comma-separated-values", "application/octet-stream"},
}


class DocumentError(ValueError):
    """The upload is invalid; the message is safe to show the user."""
    pass


def detect_kind(filename: str, content_type: Optional[str]) -> str:
    """File extension (.pdf/.txt/.csv) after checking it is allowed and matches the declared type."""
    name = (filename or "").lower()
    ext = next((e for e in ALLOWED_EXTENSIONS if name.endswith(e)), None)
    if not ext:
        raise DocumentError("Only PDF, TXT, and CSV files are supported")
    if content_type and content_type not in ALLOWED_EXTENSIONS[ext]:
        raise DocumentError(f"File type {content_type} does not match the {ext} extension")
    return ext


def extract_text(data: bytes, ext: str) -> str:
    """Plain text from the file, whitespace-collapsed and capped at MAX_STORED_CHARS; DocumentError if none."""
    if ext == ".pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            raise DocumentError(f"Could not read PDF: {e}")
    else:
        text = data.decode("utf-8", errors="replace")

    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        raise DocumentError("No readable text found in this document (scanned PDFs are not supported)")
    return text[:MAX_STORED_CHARS]


def save_document(db: Session, user_id: str, filename: str, content_type: str, data: bytes) -> Document:
    """Validates, extracts and stores an upload for a user; returns the new Document."""
    ext = detect_kind(filename, content_type)
    text = extract_text(data, ext)
    doc = Document(
        user_id=user_id,
        filename=filename,
        content_type=content_type or "application/octet-stream",
        size_bytes=len(data),
        text_content=text,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documents(db: Session, user_id: str) -> list[Document]:
    """A user's documents, newest first."""
    return (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
        .all()
    )


def delete_document(db: Session, user_id: str, document_id: str) -> bool:
    """Deletes a user's document; False if it doesn't exist or isn't theirs."""
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        return False
    db.delete(doc)
    db.commit()
    return True


def find_relevant_excerpts(
    db: Session,
    user_id: str,
    terms: list[str],
    max_excerpts: int = 4,
    window: int = 300,
) -> list[dict]:
    """
    Keyword retrieval over the user's documents: returns short excerpts
    around mentions of any of the given terms (e.g. ticker, company name).
    """
    terms = [t for t in terms if t and len(t) >= 2]
    if not user_id or not terms:
        return []
    pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.IGNORECASE)

    excerpts = []
    for doc in list_documents(db, user_id):
        for match in pattern.finditer(doc.text_content):
            start = max(0, match.start() - window // 2)
            end = min(len(doc.text_content), match.end() + window // 2)
            excerpts.append({
                "document": doc.filename,
                "excerpt": doc.text_content[start:end].replace("\n", " ").strip(),
            })
            if len(excerpts) >= max_excerpts:
                return excerpts
            break  # one excerpt per document keeps sources diverse
    return excerpts
