
import os

class Settings:
    PROJECT_NAME: str = "MLPro Platform"
    PROJECT_VERSION: str = "1.0.0"
    
    # SECURITY
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS_IN_PRODUCTION" 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 days
    
    # PATHS
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_ROOT = os.path.join(BASE_DIR, "user_data")
    
    # DATABASE
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

settings = Settings()
