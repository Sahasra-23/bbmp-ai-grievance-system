from datetime import datetime, timedelta
from jose import jwt, JWTError

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"


def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(hours=24)

    to_encode.update({"exp": expire})

    token = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


def verify_token(token: str):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # DEBUG PRINTS
        print("TOKEN:", token)
        print("PAYLOAD:", payload)

        return payload

    except JWTError as e:

        print("JWT ERROR:", e)

        return None