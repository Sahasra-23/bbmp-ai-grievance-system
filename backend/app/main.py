from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.models import Complaint
from app.schemas.complaint import ComplaintCreate, ComplaintStatusUpdate

#auth part
from app.db.models import User
from app.schemas.user import UserCreate, UserLogin
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt_handler import create_access_token

from fastapi import Depends
from app.auth.dependencies import get_current_user

# ML part
from ml.predict import predict_category


ALLOWED_STATUSES = {"OPEN", "WORKING", "CLOSED"}
ALLOWED_STATUS_TRANSITIONS = {
    "OPEN": {"OPEN", "WORKING", "CLOSED"},
    "WORKING": {"WORKING", "CLOSED"},
    "CLOSED": {"CLOSED"},
}


def serialize_complaint(complaint: Complaint):
    return {
        "id": complaint.id,
        "title": complaint.title,
        "description": complaint.description,
        "status": complaint.status,
        "category": complaint.category
    }


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    try:
        email = data.email.strip().lower()

        existing_user = db.query(User).filter(
            User.email == email
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists"
            )

        hashed_pw = hash_password(data.password)

        user = User(
            name=data.name.strip(),
            email=email,
            password_hash=hashed_pw,
            role=data.role
        )

        db.add(user)
        db.commit()

        return {"message": "User registered"}

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    finally:
        db.close()

@app.post("/login")
def login(data: UserLogin):

    db = SessionLocal()

    try:
        user = db.query(User).filter(
            User.email == data.email.strip().lower()
        ).first()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        if not verify_password(
            data.password,
            user.password_hash
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        token = create_access_token(
            {"sub": user.email}
        )

        return {
            "access_token": token
        }

    finally:
        db.close()




# Create complaint
@app.post("/complaints")
def create_complaint(
    data: ComplaintCreate,
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()

    try:
        # Find logged-in user
        db_user = db.query(User).filter(
            User.email == user["sub"]
        ).first()

        if not db_user:
            raise HTTPException(
                status_code=401,
                detail="User account not found. Please login again."
            )

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

    finally:
        db.close()
@app.get("/my-complaints")
def get_my_complaints(
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()

    try:
        db_user = db.query(User).filter(
            User.email == user["sub"]
        ).first()

        if not db_user:
            raise HTTPException(
                status_code=401,
                detail="User account not found. Please login again."
            )

        complaints = db.query(Complaint).filter(
            Complaint.user_id == db_user.id
        ).all()

        return [
            serialize_complaint(complaint)
            for complaint in complaints
        ]

    finally:
        db.close()


@app.patch("/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int,
    data: ComplaintStatusUpdate,
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()

    try:
        db_user = db.query(User).filter(
            User.email == user["sub"]
        ).first()

        if not db_user:
            raise HTTPException(
                status_code=401,
                detail="User account not found. Please login again."
            )

        complaint = db.query(Complaint).filter(
            Complaint.id == complaint_id,
            Complaint.user_id == db_user.id
        ).first()

        if not complaint:
            raise HTTPException(
                status_code=404,
                detail="Complaint not found"
            )

        new_status = data.status.strip().upper()

        if new_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Status must be OPEN, WORKING, or CLOSED"
            )

        current_status = (complaint.status or "OPEN").upper()
        allowed_next_statuses = ALLOWED_STATUS_TRANSITIONS.get(
            current_status,
            {"CLOSED"}
        )

        if new_status not in allowed_next_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from {current_status} to {new_status}"
            )

        complaint.status = new_status
        db.commit()
        db.refresh(complaint)

        return serialize_complaint(complaint)

    finally:
        db.close()

