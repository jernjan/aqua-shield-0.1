"""Farm management API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User, Farm
from app.core.security import get_current_user
from app.schemas.schemas import FarmCreate, FarmUpdate, FarmResponse
from app.logging.logger import logger
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/farms", tags=["farms"])


class PaginatedFarmResponse(BaseModel):
    data: List[FarmResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True


@router.post("", response_model=FarmResponse)
def create_farm(
    farm: FarmCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new farm for current user."""
    user_id = int(current_user["user_id"])
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    new_farm = Farm(
        owner_id=user_id,
        name=farm.name,
        latitude=farm.latitude,
        longitude=farm.longitude,
        description=farm.description
    )
    
    db.add(new_farm)
    db.commit()
    db.refresh(new_farm)
    
    logger.info(f"Farm created: {new_farm.id} by user {user_id}")
    return new_farm


@router.get("", response_model=PaginatedFarmResponse)
def get_farms(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Get farms for current user with pagination. In demo mode, returns all farms."""
    user_id = int(current_user["user_id"])
    is_demo = current_user.get("is_demo", False)
    
    # In demo mode, show all farms. Otherwise, show only user's farms
    if is_demo:
        # Get total count of all active farms
        total = db.query(Farm).filter(Farm.is_active == True).count()
        
        # Get paginated results of all active farms
        farms = db.query(Farm).filter(
            Farm.is_active == True
        ).offset((page - 1) * page_size).limit(page_size).all()
    else:
        # Get total count of user's farms
        total = db.query(Farm).filter(
            Farm.owner_id == user_id,
            Farm.is_active == True
        ).count()
        
        # Get paginated results of user's farms
        farms = db.query(Farm).filter(
            Farm.owner_id == user_id,
            Farm.is_active == True
        ).offset((page - 1) * page_size).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedFarmResponse(
        data=farms,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )



@router.get("/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get specific farm details."""
    user_id = int(current_user["user_id"])
    
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    return farm


@router.put("/{farm_id}", response_model=FarmResponse)
def update_farm(
    farm_id: int,
    farm_update: FarmUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update farm details."""
    user_id = int(current_user["user_id"])
    
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    # Update fields if provided
    update_data = farm_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(farm, field, value)
    
    db.add(farm)
    db.commit()
    db.refresh(farm)
    
    logger.info(f"Farm updated: {farm_id}")
    return farm


@router.delete("/{farm_id}")
def delete_farm(
    farm_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete (deactivate) a farm."""
    user_id = int(current_user["user_id"])
    
    farm = db.query(Farm).filter(
        Farm.id == farm_id,
        Farm.owner_id == user_id
    ).first()
    
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm not found"
        )
    
    farm.is_active = False
    db.add(farm)
    db.commit()
    
    logger.info(f"Farm deleted: {farm_id}")
    return {"message": "Farm deleted successfully"}
