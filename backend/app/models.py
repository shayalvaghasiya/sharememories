from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from .database import Base

class Event(Base):
    __tablename__ = "events"
    
    event_id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String, nullable=False)
    event_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    photos = relationship("Photo", back_populates="event")

class Photo(Base):
    __tablename__ = "photos"
    
    photo_id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.event_id"))
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=func.now())
    
    event = relationship("Event", back_populates="photos")
    faces = relationship("Face", back_populates="photo")

class Face(Base):
    __tablename__ = "faces"
    
    face_id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.photo_id"))
    # Embedding from InsightFace (usually 512 dimensions for buffalo_l)
    embedding = Column(Vector(512))
    
    photo = relationship("Photo", back_populates="faces")