from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.models import Complaint
from app.schemas.complaint import ComplaintCreate

#auth part
from app.db.models import User
from app.schemas.user import UserCreate, UserLogin
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt_handler import create_access_token

from fastapi import Depends
from app.auth.dependencies import get_current_user

# ML part
from ml.predict import predict_category


app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)


# Home route
@app.get("/")
def home():
    return {"message": "Backend working jhb"}

#related to auth
@app.post("/register")
def register(data: UserCreate):

    db = SessionLocal()

    hashed_pw = hash_password(data.password)

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hashed_pw,
        role=data.role
    )

    db.add(user)
    db.commit()

    return {"message": "User registered"}

@app.post("/login")
def login(data: UserLogin):

    db = SessionLocal()

    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        return {"error": "Invalid email"}

    if not verify_password(
        data.password,
        user.password_hash
    ):
        return {"error": "Invalid password"}

    token = create_access_token(
        {"sub": user.email}
    )

    return {
        "access_token": token
    }




# Create complaint
@app.post("/complaints")
def create_complaint(
    data: ComplaintCreate,
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()

    # Find logged-in user
    db_user = db.query(User).filter(
        User.email == user["sub"]
    ).first()

    # ML prediction
    predicted_category = predict_category(
        data.description
    )

    # Create complaint
    complaint = Complaint(
        title=data.title,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        status="OPEN",
        category=predicted_category,
        user_id=db_user.id
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    return {

        "message": "Complaint created",
        "complaint_id": complaint.id,
        "created_by": db_user.email,
        "predicted_category": predicted_category
    }
@app.get("/my-complaints")
def get_my_complaints(
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()

    db_user = db.query(User).filter(
        User.email == user["sub"]
    ).first()

    complaints = db.query(Complaint).filter(
        Complaint.user_id == db_user.id
    ).all()

    result = []

    for complaint in complaints:

        result.append({
            "id": complaint.id,
            "title": complaint.title,
            "description": complaint.description,
            "status": complaint.status,
            "category": complaint.category
        })

    return result