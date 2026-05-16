from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)
#bycrypt was not compatible with python 3.14 so I switched to pbkdf2_sha256 which is compatible and secure

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(
        plain_password,
        hashed_password
    )