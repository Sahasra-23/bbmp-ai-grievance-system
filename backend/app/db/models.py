from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from datetime import datetime

from .base import Base


# USERS TABLE
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String, unique=True)
    password_hash = Column(String)
    role = Column(String)


# CATEGORIES TABLE
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)


# WARDS TABLE
class Ward(Base):
    __tablename__ = "wards"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    zone = Column(String)


# COMPLAINTS TABLE
class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True)

    title = Column(String)
    description = Column(String)

    status = Column(String, default="OPEN")

    latitude = Column(Float)
    longitude = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    # FOREIGN KEYS
    user_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    ward_id = Column(Integer, ForeignKey("wards.id"))