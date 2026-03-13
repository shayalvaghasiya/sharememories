import os
import shutil
import time
import logging
import cv2
import numpy as np
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from insightface.app import FaceAnalysis
from sqlalchemy.orm import Session
from sqlalchemy import text
from . import models, schemas, database, worker

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Wedding AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize InsightFace model globally for search
app_face = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
app_face.prepare(ctx_id=0, det_size=(640, 640))

# Mount storage to serve images statically for development
app.mount("/storage", StaticFiles(directory="/storage"), name="storage")

# Create tables and enable vector extension on startup
@app.on_event("startup")
def startup_event():
    # Enable pgvector extension
    with database.engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    
    # Create tables
    models.Base.metadata.create_all(bind=database.engine)

@app.get("/")
def read_root():
    return {"message": "System is running", "status": "ok"}

@app.get("/health")
def health_check(db: Session = Depends(database.get_db)):
    try:
        # Simple query to check DB connection
        db.execute(text("SELECT 1"))
        return {"database": "connected", "redis": "checking..."}
    except Exception as e:
        return {"database": f"error: {str(e)}"}

@app.post("/events/", response_model=schemas.Event)
def create_event(event: schemas.EventCreate, db: Session = Depends(database.get_db)):
    try:
        db_event = models.Event(event_name=event.event_name, event_date=event.event_date)
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        return db_event
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/events/{event_id}/upload")
def upload_photos(
    event_id: int, 
    files: List[UploadFile] = File(...), 
    db: Session = Depends(database.get_db)
):
    # Verify event exists
    event = db.query(models.Event).filter(models.Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    storage_path = f"/storage/events/{event_id}/photos"
    os.makedirs(storage_path, exist_ok=True)
    
    saved_photos = []
    
    for file in files:
        file_location = f"{storage_path}/{file.filename}"
        
        # Save to disk
        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Save to DB
        new_photo = models.Photo(event_id=event_id, file_path=file_location)
        db.add(new_photo)
        db.commit()
        db.refresh(new_photo)
        
        # Queue for AI Processing (Phase 4)
        worker.process_photo_task.delay(new_photo.photo_id, file_location)
        
        saved_photos.append(new_photo.photo_id)
        
    return {"message": "Upload successful", "photo_ids": saved_photos}

@app.post("/search")
def search_faces(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    start_time = time.time()
    logger.info(f"Received search request for file: {file.filename}")
    
    # Read image file from upload
    contents = file.file.read()
    logger.info(f"File read complete. Size: {len(contents) / 1024 / 1024:.2f} MB")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        logger.error("Error: Could not decode image file")
        raise HTTPException(status_code=400, detail="Invalid image file")

    logger.info("Starting face detection (Inference)...")
    # Detect face
    # Note: This is CPU intensive and might pause the server for 1-3 seconds
    faces = app_face.get(img)
    logger.info(f"Face detection finished in {time.time() - start_time:.2f}s. Found {len(faces)} faces.")

    if not faces:
        logger.warning("No face detected in uploaded photo")
        raise HTTPException(status_code=400, detail="No face detected. Please try a clearer selfie.")
    
    # Use the largest face found
    faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
    user_embedding = faces[0].embedding.tolist()

    # Search using pgvector cosine distance
    logger.info("Querying database for matches...")
    
    # DEBUG: Get top 5 closest regardless of threshold to see values
    debug_results = db.query(models.Face.embedding.cosine_distance(user_embedding)).order_by(models.Face.embedding.cosine_distance(user_embedding)).limit(5).all()
    logger.info(f"DEBUG: Top 5 distances found: {[r[0] for r in debug_results]}")

    results = db.query(models.Photo).join(models.Face).filter(models.Face.embedding.cosine_distance(user_embedding) < 0.6).order_by(models.Face.embedding.cosine_distance(user_embedding)).limit(50).all()
    
    logger.info(f"Found {len(results)} matches. Total time: {time.time() - start_time:.2f}s")
    return {"matches": [photo.file_path for photo in results]}

@app.delete("/reset")
def reset_system(db: Session = Depends(database.get_db)):
    logger.warning("Resetting system: Clearing database and storage.")
    
    # 1. Clear Database
    # TRUNCATE events CASCADE will also truncate photos and faces due to foreign keys
    db.execute(text("TRUNCATE TABLE events RESTART IDENTITY CASCADE"))
    db.commit()

    # 2. Clear Storage
    if os.path.exists("/storage/events"):
        shutil.rmtree("/storage/events")
        
    return {"message": "System reset successfully. All events, photos, and faces have been deleted."}
