from pydantic import BaseModel


class ComplaintCreate(BaseModel):
    title: str
    description: str
    latitude: float
    longitude: float


class ComplaintStatusUpdate(BaseModel):
    status: str
