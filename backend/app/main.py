import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy import inspect, text
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
from ml.hybrid_predict import choose_final_prediction
from ml.image_predict import (
    ImageModelNotFoundError,
    ImagePredictionError,
    predict_image_category,
)
from ml.predict import predict_category_with_confidence


ALLOWED_STATUSES = {"OPEN", "WORKING", "CLOSED"}
ALLOWED_STATUS_TRANSITIONS = {
    "OPEN": {"OPEN", "WORKING", "CLOSED"},
    "WORKING": {"WORKING", "CLOSED"},
    "CLOSED": {"CLOSED"},
}
BACKEND_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BACKEND_DIR / "uploads"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE = 10 * 1024 * 1024


def serialize_complaint(complaint: Complaint):
    image_url = None

    if complaint.image_path:
        image_url = "/" + complaint.image_path.replace("\\", "/")

    return {
        "id": complaint.id,
        "title": complaint.title,
        "description": complaint.description,
        "status": complaint.status,
        "category": complaint.category,
        "latitude": complaint.latitude,
        "longitude": complaint.longitude,
        "address": getattr(complaint, "address", None),
        "ward_number": getattr(complaint, "ward_number", None),
        "ward_name": getattr(complaint, "ward_name", None),
        "image_path": complaint.image_path,
        "image_url": image_url,
        "text_prediction": getattr(complaint, "text_prediction", None),
        "image_prediction": getattr(complaint, "image_prediction", None),
        "prediction_confidence": complaint.prediction_confidence,
        "prediction_source": complaint.prediction_source,
        "analysis_status": complaint.analysis_status,
        "user_corrected": complaint.user_corrected,
        "category_verified": complaint.category_verified,
        "created_at": complaint.created_at.isoformat() if complaint.created_at else None,
    }


def ensure_database_columns():
    inspector = inspect(engine)
    columns = [
        column["name"]
        for column in inspector.get_columns("complaints")
    ]

    if "image_path" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN image_path VARCHAR")
            )
            connection.commit()
    if "text_prediction" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN text_prediction VARCHAR")
            )
            connection.commit()
    if "image_prediction" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN image_prediction VARCHAR")
            )
            connection.commit()
    if "prediction_confidence" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN prediction_confidence FLOAT")
            )
            connection.commit()
    if "prediction_source" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN prediction_source VARCHAR")
            )
            connection.commit()
    if "analysis_status" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN analysis_status VARCHAR")
            )
            connection.commit()
    if "user_corrected" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN user_corrected VARCHAR DEFAULT 'false'")
            )
            connection.commit()
    if "category_verified" not in columns:
        with engine.connect() as connection:
            connection.execute(
                text("ALTER TABLE complaints ADD COLUMN category_verified VARCHAR DEFAULT 'false'")
            )
            connection.commit()
    if "address" not in columns:
        with engine.connect() as connection:
            connection.execute(text("ALTER TABLE complaints ADD COLUMN address VARCHAR"))
            connection.commit()
    if "ward_number" not in columns:
        with engine.connect() as connection:
            connection.execute(text("ALTER TABLE complaints ADD COLUMN ward_number VARCHAR"))
            connection.commit()
    if "ward_name" not in columns:
        with engine.connect() as connection:
            connection.execute(text("ALTER TABLE complaints ADD COLUMN ward_name VARCHAR"))
            connection.commit()


def save_uploaded_image(image: UploadFile):
    if not image:
        return None

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP images are allowed"
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    extension = IMAGE_EXTENSIONS[image.content_type]
    filename = f"{uuid4().hex}{extension}"
    image_path = UPLOAD_DIR / filename

    with image_path.open("wb") as output_file:
        total_bytes = 0
        while chunk := image.file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > MAX_IMAGE_SIZE:
                output_file.close()
                image_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail="Image must be 10 MB or smaller"
                )
            output_file.write(chunk)

    return image_path


UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)
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


@app.middleware("http")
async def log_request_path(request, call_next):
    if request.url.path == "/complaints":
        print("HTTP REQUEST:", request.method, request.url.path)
    return await call_next(request)

# Create tables
Base.metadata.create_all(bind=engine)
ensure_database_columns()


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
            role="citizen"
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




@app.post("/complaints")
def create_complaint(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    address: str = Form(None),
    ward_number: str = Form(None),
    ward_name: str = Form(None),
    image: UploadFile = File(...),
    user=Depends(get_current_user)
):

    db: Session = SessionLocal()
    saved_image_path = None

    try:
        print("Complaint created request received")
        # Find logged-in user
        db_user = db.query(User).filter(
            User.email == user["sub"]
        ).first()

        if not db_user:
            raise HTTPException(
                status_code=401,
                detail="User account not found. Please login again."
            )

        saved_image_path = save_uploaded_image(image)
        print("Image saved:", saved_image_path)

        stored_image_path = f"uploads/{saved_image_path.name}"

        # Create complaint
        complaint = Complaint(
            title=title,
            description=description,
            latitude=latitude,
            longitude=longitude,
            address=address,
            ward_number=ward_number,
            ward_name=ward_name,
            status="OPEN",
            category=None,
            image_path=stored_image_path,
            prediction_confidence=None,
            prediction_source=None,
            analysis_status="PENDING",
            user_id=db_user.id
        )
        db.add(complaint)
        db.commit()
        db.refresh(complaint)

        print("Complaint ID:", complaint.id)
        print("AI analysis in progress...")

        background_tasks.add_task(
            analyze_complaint_background,
            complaint.id,
            description,
            str(saved_image_path),
        )

        return {

            "message": "Complaint created",
            "complaint_id": complaint.id,
            "created_by": db_user.email,
            "predicted_category": None,
            "prediction": None,
            "image_path": stored_image_path
        }

    except Exception as e:
        import traceback

        print("\n" + "=" * 80)
        print("UNEXPECTED ERROR DURING COMPLAINT CREATION")
        traceback.print_exc()
        print("=" * 80 + "\n")

        if saved_image_path:
            saved_image_path.unlink(missing_ok=True)

        db.rollback()
        raise

    finally:
        if image:
            image.file.close()
        db.close()


def analyze_complaint_background(complaint_id: int, description: str, image_path: str):
    print("=== AI ANALYSIS START ===")
    print("Background task complaint ID:", complaint_id)
    print("Background task image path:", image_path)
    print("Background task image exists:", Path(image_path).exists())
    db: Session = SessionLocal()

    try:
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not complaint:
            print("Complaint not found for analysis:", complaint_id)
            return

        try:
            print("Text prediction started")
            text_prediction = predict_category_with_confidence(description)
            print("Text prediction completed")
            print("Text prediction result:", text_prediction)

            try:
                print("Image prediction started")
                image_prediction = predict_image_category(Path(image_path))
                print("Image prediction completed")
                print("Image prediction result:", image_prediction)

                print("Hybrid prediction started")
                final_prediction = choose_final_prediction(
                    text_prediction,
                    image_prediction,
                )
                print("Hybrid prediction completed")

                complaint.category = final_prediction["category"]
                complaint.text_prediction = text_prediction["category"]
                complaint.image_prediction = image_prediction["category"]
                complaint.prediction_confidence = final_prediction["confidence"]
                complaint.prediction_source = "hybrid"
                complaint.analysis_status = "COMPLETED"
            except Exception:
                import traceback
                traceback.print_exc()
                print("Image prediction failed, falling back to text prediction")
                complaint.category = text_prediction["category"]
                complaint.text_prediction = text_prediction["category"]
                complaint.image_prediction = "FAILED"
                complaint.prediction_confidence = text_prediction["confidence"]
                complaint.prediction_source = "text_fallback"
                complaint.analysis_status = "COMPLETED"

            print("Database update started")
            db.commit()
            print("Database updated successfully")
            print("=== AI ANALYSIS COMPLETE ===")
        except Exception:
            import traceback
            traceback.print_exc()
            complaint.analysis_status = "FAILED"
            db.commit()
            print("=== AI ANALYSIS COMPLETE ===")
    finally:
        db.close()
@app.get("/public/complaints")
def get_public_complaints():
    db: Session = SessionLocal()
    try:
        complaints = db.query(Complaint).all()
        return [
            {
                "id": c.id,
                "title": c.title,
                "category": c.category,
                "status": c.status,
                "ward_name": c.ward_name,
                "latitude": c.latitude,
                "longitude": c.longitude,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in complaints if c.latitude is not None and c.longitude is not None
        ]
    finally:
        db.close()


@app.get("/public/stats")
def get_public_stats():
    db: Session = SessionLocal()
    try:
        complaints = db.query(Complaint).all()
        return {
            "total": len(complaints),
            "open": sum(1 for c in complaints if (c.status or "OPEN").upper() == "OPEN"),
            "in_progress": sum(1 for c in complaints if (c.status or "").upper() == "WORKING"),
            "completed": sum(1 for c in complaints if (c.status or "").upper() == "CLOSED"),
            "roads": sum(1 for c in complaints if (c.category or "").lower() == "roads"),
            "sanitation": sum(1 for c in complaints if (c.category or "").lower() == "sanitation"),
            "water_supply": sum(1 for c in complaints if (c.category or "").lower() == "water supply"),
            "electrical": sum(1 for c in complaints if (c.category or "").lower() in ["electricity", "electrical", "street light"]),
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


@app.get("/me")
def get_my_profile(
    user=Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        db_user = db.query(User).filter(User.email == user["sub"]).first()
        if not db_user:
            raise HTTPException(
                status_code=401,
                detail="User account not found. Please login again."
            )

        complaints = db.query(Complaint).filter(
            Complaint.user_id == db_user.id
        ).order_by(Complaint.created_at.desc()).all()

        last_complaint = complaints[0] if complaints else None
        pending_count = sum(
            1 for complaint in complaints
            if (complaint.analysis_status or "").upper() == "PENDING"
        )
        resolved_count = sum(
            1 for complaint in complaints
            if (complaint.status or "").upper() == "CLOSED"
        )
        rejected_count = sum(
            1 for complaint in complaints
            if (complaint.status or "").upper() == "REJECTED"
        )
        ai_corrected_count = sum(
            1 for complaint in complaints
            if str(getattr(complaint, "user_corrected", "false")).lower() == "true"
        )
        ai_accepted_count = max(len(complaints) - ai_corrected_count, 0)
        acceptance_rate = (
            (ai_accepted_count / len(complaints)) * 100
            if complaints else 0
        )

        return {
            "name": db_user.name,
            "email": db_user.email,
            "role": db_user.role,
            "member_since": complaints[-1].created_at.isoformat() if complaints else None,
            "total_complaints": len(complaints),
            "last_complaint_date": last_complaint.created_at.isoformat() if last_complaint and last_complaint.created_at else None,
            "summary": {
                "total_complaints": len(complaints),
                "pending": pending_count,
                "resolved": resolved_count,
                "rejected": rejected_count,
                "ai_corrected": ai_corrected_count,
                "ai_accepted": ai_accepted_count,
                "acceptance_rate": acceptance_rate,
                "latest_complaint": serialize_complaint(last_complaint) if last_complaint else None,
            },
        }
    finally:
        db.close()


@app.patch("/complaints/{complaint_id}/category")
def update_complaint_category(
    complaint_id: int,
    data: dict,
    user=Depends(get_current_user)
):
    db: Session = SessionLocal()

    try:
        db_user = db.query(User).filter(User.email == user["sub"]).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="User account not found. Please login again.")

        complaint = db.query(Complaint).filter(
            Complaint.id == complaint_id,
            Complaint.user_id == db_user.id
        ).first()
        if not complaint:
            raise HTTPException(status_code=404, detail="Complaint not found")

        category = str(data.get("category", "")).strip()
        if not category:
            raise HTTPException(status_code=400, detail="Category is required")

        complaint.category = category
        complaint.user_corrected = "true"
        complaint.category_verified = "false"
        db.commit()
        db.refresh(complaint)
        return serialize_complaint(complaint)
    finally:
        db.close()


@app.get("/complaints/{complaint_id}")
def get_complaint(
    complaint_id: int,
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

        return serialize_complaint(complaint)
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
