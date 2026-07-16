from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.jwt_handler import verify_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    print("get_current_user called")
    print("Authorization scheme:", credentials.scheme)

    token = credentials.credentials
    print("Token present:", bool(token))

    payload = verify_token(token)
    print("Token payload:", payload)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return payload
