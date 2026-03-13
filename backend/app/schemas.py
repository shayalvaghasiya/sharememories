from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class EventBase(BaseModel):
    event_name: str
    event_date: Optional[datetime] = None

class EventCreate(EventBase):
    pass

class Event(EventBase):
    event_id: int
    created_at: datetime

    class Config:
        from_attributes = True