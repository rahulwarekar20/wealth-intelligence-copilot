"""
Password hashing, JWT creation, and the get_current_user_id auth dependency.

Sessions slide: once a token is past half its lifetime, any authenticated
request returns a fresh token in the REFRESH_HEADER response header, which the
frontend stores. Active users stay signed in; only idle sessions expire.
"""

from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

# Response header carrying a renewed token (exposed to the browser via CORS in main.py)
REFRESH_HEADER = "X-Refreshed-Token"

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
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency: the user id from a valid Bearer token; 401 if missing,
    invalid or expired. Renews the token (REFRESH_HEADER) when less than half
    of its lifetime is left.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        remaining = datetime.fromtimestamp(payload["exp"], tz=timezone.utc) - datetime.now(timezone.utc)
        if remaining < timedelta(minutes=settings.JWT_EXPIRE_MINUTES / 2):
            response.headers[REFRESH_HEADER] = create_access_token(user_id)
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")