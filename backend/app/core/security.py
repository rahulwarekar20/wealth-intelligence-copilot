"""Password hashing, JWT creation, and the get_current_user_id auth dependency."""

from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    """bcrypt hash of a password, for storage."""
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """True if the password matches the stored bcrypt hash."""
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, expires_minutes: int = None) -> str:
    """Signed JWT for a user id, expiring after JWT_EXPIRE_MINUTES unless overridden."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes if expires_minutes is not None else settings.JWT_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> str:
    """FastAPI dependency: the user id from a valid Bearer token; 401 if missing, invalid or expired."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")