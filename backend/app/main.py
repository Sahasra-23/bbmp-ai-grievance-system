from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.models import Complaint
from app.schemas.complaint import ComplaintCreate

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)


# Home route
@app.get("/")
def home():
    return {"message": "Backend working jhb"}


# Create complaint
@app.post("/complaints")
def create_complaint(data: ComplaintCreate):

    db: Session = SessionLocal()

    complaint = Complaint(
        title=data.title,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        status="OPEN"
    )

    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    return {
        "message": "Complaint created",
        "complaint_id": complaint.id
    }