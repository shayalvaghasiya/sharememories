from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from . import models, schemas, database

app = FastAPI(title="Wedding AI API")

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
    db_event = models.Event(event_name=event.event_name, event_date=event.event_date)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event
