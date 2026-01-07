
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.db import models
from app.db.database import get_db
from app.core.config import settings
from app.core import security
import os

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_user_dir(user: models.User = Depends(get_current_user)) -> str:
    """
    Ensure user directory exists and return its path.
    Structure:
      /user_data/{user_id}/
        workflows/
        uploads/
        config/
    """
    user_dir = os.path.join(settings.DATA_ROOT, str(user.id))
    
    # Subdirectories
    os.makedirs(os.path.join(user_dir, "workflows"), exist_ok=True)
    os.makedirs(os.path.join(user_dir, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(user_dir, "config"), exist_ok=True)
    
    return user_dir
