from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Baby, User
from app.schemas.baby import BabyCreate, BabyUpdate, BabyResponse
import datetime

router = APIRouter(prefix="/api/v1/baby", tags=["baby"])

def get_current_user(db: Session = Depends(get_db)) -> User:
    # Development owner abstraction (mocked authenticated mother)
    user = db.query(User).filter(User.email == "dev_mother@example.com").first()
    if not user:
        user = User(email="dev_mother@example.com", name="Development Mother")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.post("/register", response_model=BabyResponse, status_code=status.HTTP_201_CREATED)
def register_baby(baby_in: BabyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Baby).filter(Baby.owner_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already has a registered baby in this prototype.")
        
    baby = Baby(
        owner_id=current_user.id,
        name=baby_in.name,
        sex=baby_in.sex,
        date_of_birth=baby_in.date_of_birth,
        birth_weight_kg=baby_in.birth_weight_kg,
        birth_length_cm=baby_in.birth_length_cm,
        gestational_age_weeks=baby_in.gestational_age_weeks,
        birth_order=baby_in.birth_order,
        delivery_type=baby_in.delivery_type,
        apgar_score_5min=baby_in.apgar_score_5min
    )
    db.add(baby)
    db.commit()
    db.refresh(baby)
    return baby

@router.get("/profile", response_model=BabyResponse)
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = db.query(Baby).filter(Baby.owner_id == current_user.id).first()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    return baby

@router.put("/profile", response_model=BabyResponse)
def update_profile(baby_update: BabyUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    baby = db.query(Baby).filter(Baby.owner_id == current_user.id).first()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
        
    update_data = baby_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(baby, key, value)
        
    db.commit()
    db.refresh(baby)
    return baby
