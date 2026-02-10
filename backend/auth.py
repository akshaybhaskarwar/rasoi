"""
Authentication Module for Rasoi-Sync
- Email/Password authentication with bcrypt hashing
- JWT token-based sessions
- Password reset with email tokens
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import secrets
import os

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Security
security = HTTPBearer(auto_error=False)

# Router
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ============ MODELS ============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    home_language: str = "en"  # en, hi, mr
    city: str = "Pune"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    home_language: str = "en"
    city: str = "Pune"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    home_language: str = "en"
    city: str = "Pune"
    households: List[str] = []  # List of household IDs user belongs to
    active_household: Optional[str] = None  # Currently selected household
    is_admin: bool = False
    onboarding_complete: bool = False  # Whether user has completed onboarding
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)

# ============ DEPENDENCY ============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db=None):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Get user from database
    if db:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        return user
    
    return {"id": user_id, **payload}

# ============ ROUTES ============
# Note: These routes will be registered with the database in server.py

def create_auth_routes(db):
    """Factory function to create auth routes with database access"""
    
    @auth_router.post("/signup", response_model=Token)
    async def signup(user_data: UserCreate):
        # Check if user already exists
        existing_user = await db.users.find_one({"email": user_data.email.lower()})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user
        user_dict = {
            "id": str(uuid.uuid4()),
            "email": user_data.email.lower(),
            "name": user_data.name,
            "hashed_password": hash_password(user_data.password),
            "home_language": user_data.home_language,
            "city": user_data.city,
            "households": [],
            "active_household": None,
            "is_admin": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(user_dict)
        
        # Create token
        access_token = create_access_token({"sub": user_dict["id"], "email": user_dict["email"]})
        
        # Return user without password
        user_response = {k: v for k, v in user_dict.items() if k != "hashed_password" and k != "_id"}
        
        return Token(access_token=access_token, user=user_response)
    
    @auth_router.post("/login", response_model=Token)
    async def login(credentials: UserLogin):
        user = await db.users.find_one({"email": credentials.email.lower()})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        if not verify_password(credentials.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create token
        access_token = create_access_token({"sub": user["id"], "email": user["email"]})
        
        # Return user without password
        user_response = {k: v for k, v in user.items() if k != "hashed_password" and k != "_id"}
        
        return Token(access_token=access_token, user=user_response)
    
    @auth_router.get("/me")
    async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Convert datetime for JSON serialization
        if isinstance(user.get("created_at"), datetime):
            user["created_at"] = user["created_at"].isoformat()
        
        return user
    
    @auth_router.post("/complete-onboarding")
    async def complete_onboarding(credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Mark user's onboarding as complete"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "onboarding_complete": True,
                "show_essentials_banner": True  # Show banner on home page
            }}
        )
        
        return {"message": "Onboarding marked as complete"}
    
    @auth_router.post("/forgot-password")
    async def forgot_password(data: PasswordReset):
        user = await db.users.find_one({"email": data.email.lower()})
        if not user:
            # Don't reveal if email exists
            return {"message": "If this email exists, a reset link has been sent"}
        
        # Generate reset token
        reset_token = generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        # Store token
        await db.password_resets.insert_one({
            "user_id": user["id"],
            "token": reset_token,
            "expires_at": expires_at,
            "used": False
        })
        
        # In production, send email here
        # For now, return token in response (development only)
        return {
            "message": "If this email exists, a reset link has been sent",
            "dev_token": reset_token  # Remove in production
        }
    
    @auth_router.post("/reset-password")
    async def reset_password(data: PasswordResetConfirm):
        # Find valid reset token
        reset_record = await db.password_resets.find_one({
            "token": data.token,
            "used": False,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        if not reset_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        # Update password
        await db.users.update_one(
            {"id": reset_record["user_id"]},
            {"$set": {"hashed_password": hash_password(data.new_password)}}
        )
        
        # Mark token as used
        await db.password_resets.update_one(
            {"token": data.token},
            {"$set": {"used": True}}
        )
        
        return {"message": "Password reset successful"}
    
    @auth_router.post("/change-password")
    async def change_password(
        data: PasswordChange,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not verify_password(data.current_password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Update password
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"hashed_password": hash_password(data.new_password)}}
        )
        
        return {"message": "Password changed successfully"}
    
    @auth_router.put("/profile")
    async def update_profile(
        updates: dict,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        
        # Only allow updating certain fields
        allowed_fields = {"name", "home_language", "city", "active_household"}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": filtered_updates}
        )
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        return user
    
    return auth_router
