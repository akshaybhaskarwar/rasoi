"""
Admin Dashboard Module for Rasoi-Sync
- API quota monitoring (YouTube, Translation)
- Translation moderation
- Festival management
- Usage analytics
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid

# Security
security = HTTPBearer(auto_error=False)

# Router
admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ============ MODELS ============

class APIUsageRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    api_name: str  # "youtube", "translation"
    endpoint: str
    units_used: int
    household_id: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FestivalEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name_en: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    date: str  # YYYY-MM-DD
    region: str = "national"  # national, maharashtra, etc.
    shopping_suggestions: List[str] = []
    dadi_message: Optional[str] = None
    is_active: bool = True

class TranslationModeration(BaseModel):
    id: str
    source_text: str
    target_lang: str
    suggested_translation: str
    suggestion_count: int
    households_using: List[str]
    status: str = "pending"  # pending, approved, rejected
    approved_translation: Optional[str] = None

# ============ ROUTES ============

def create_admin_routes(db, decode_token_func):
    """Factory function to create admin routes with database access"""
    
    async def verify_admin(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token_func(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.get("is_admin", False):
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    
    # ============ API QUOTA MONITORING ============
    
    @admin_router.get("/api-usage")
    async def get_api_usage(
        days: int = 7,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get API usage statistics"""
        await verify_admin(credentials)
        
        since = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Aggregate usage by API
        pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": "$api_name",
                "total_units": {"$sum": "$units_used"},
                "request_count": {"$sum": 1}
            }}
        ]
        
        usage = await db.api_usage.aggregate(pipeline).to_list(100)
        
        # Daily breakdown
        daily_pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {"$group": {
                "_id": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "api": "$api_name"
                },
                "units": {"$sum": "$units_used"}
            }},
            {"$sort": {"_id.date": 1}}
        ]
        
        daily = await db.api_usage.aggregate(daily_pipeline).to_list(100)
        
        # Top households by usage
        household_pipeline = [
            {"$match": {"timestamp": {"$gte": since}, "household_id": {"$ne": None}}},
            {"$group": {
                "_id": "$household_id",
                "total_units": {"$sum": "$units_used"}
            }},
            {"$sort": {"total_units": -1}},
            {"$limit": 10}
        ]
        
        top_households = await db.api_usage.aggregate(household_pipeline).to_list(10)
        
        # Get household names
        for h in top_households:
            household = await db.households.find_one({"id": h["_id"]}, {"name": 1})
            h["name"] = household["name"] if household else "Unknown"
        
        # Quota info
        quotas = {
            "youtube": {
                "daily_limit": 10000,
                "used_today": 0
            },
            "translation": {
                "daily_limit": 500000,  # Characters
                "used_today": 0
            }
        }
        
        # Get today's usage
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_usage = await db.api_usage.aggregate([
            {"$match": {"timestamp": {"$gte": today_start}}},
            {"$group": {"_id": "$api_name", "total": {"$sum": "$units_used"}}}
        ]).to_list(10)
        
        for u in today_usage:
            if u["_id"] in quotas:
                quotas[u["_id"]]["used_today"] = u["total"]
        
        return {
            "period_days": days,
            "by_api": {u["_id"]: {"total_units": u["total_units"], "requests": u["request_count"]} for u in usage},
            "daily_breakdown": daily,
            "top_households": top_households,
            "quotas": quotas
        }
    
    @admin_router.get("/api-usage/alerts")
    async def get_usage_alerts(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get alerts for unusual API usage"""
        await verify_admin(credentials)
        
        alerts = []
        
        # Check for quota warnings
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        youtube_usage = await db.api_usage.aggregate([
            {"$match": {"timestamp": {"$gte": today_start}, "api_name": "youtube"}},
            {"$group": {"_id": None, "total": {"$sum": "$units_used"}}}
        ]).to_list(1)
        
        if youtube_usage and youtube_usage[0]["total"] > 8000:
            alerts.append({
                "type": "warning",
                "message": f"YouTube API at {youtube_usage[0]['total']}/10000 units today",
                "api": "youtube"
            })
        
        # Check for heavy users (households using > 500 units/day)
        heavy_users = await db.api_usage.aggregate([
            {"$match": {"timestamp": {"$gte": today_start}, "household_id": {"$ne": None}}},
            {"$group": {"_id": "$household_id", "total": {"$sum": "$units_used"}}},
            {"$match": {"total": {"$gt": 500}}}
        ]).to_list(10)
        
        for h in heavy_users:
            household = await db.households.find_one({"id": h["_id"]}, {"name": 1})
            alerts.append({
                "type": "info",
                "message": f"Household '{household['name'] if household else 'Unknown'}' used {h['total']} units today",
                "household_id": h["_id"]
            })
        
        return {"alerts": alerts}
    
    # ============ TRANSLATION MODERATION ============
    
    @admin_router.get("/translations/pending")
    async def get_pending_translations(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get translations pending moderation"""
        await verify_admin(credentials)
        
        # Find translations with high user verification but not yet globalized
        pipeline = [
            {"$match": {
                "user_verified": True,
                "is_global": {"$ne": True},
                "verification_count": {"$gte": 5}  # At least 5 users verified
            }},
            {"$sort": {"verification_count": -1}},
            {"$limit": 50}
        ]
        
        translations = await db.translations.aggregate(pipeline).to_list(50)
        
        return {"pending": translations, "count": len(translations)}
    
    @admin_router.post("/translations/{translation_id}/approve")
    async def approve_translation(
        translation_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Approve and globalize a translation"""
        admin = await verify_admin(credentials)
        
        translation = await db.translations.find_one({"id": translation_id})
        if not translation:
            raise HTTPException(status_code=404, detail="Translation not found")
        
        await db.translations.update_one(
            {"id": translation_id},
            {"$set": {
                "is_global": True,
                "approved_by": admin["id"],
                "approved_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"message": "Translation approved and globalized"}
    
    @admin_router.post("/translations/{translation_id}/reject")
    async def reject_translation(
        translation_id: str,
        reason: str = "",
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Reject a translation suggestion"""
        admin = await verify_admin(credentials)
        
        await db.translations.update_one(
            {"id": translation_id},
            {"$set": {
                "rejected": True,
                "rejected_by": admin["id"],
                "rejection_reason": reason,
                "rejected_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"message": "Translation rejected"}
    
    @admin_router.get("/translations/community-verified")
    async def get_community_verified(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get all community-verified (gold) translations"""
        await verify_admin(credentials)
        
        translations = await db.translations.find(
            {"verification_count": {"$gte": 100}},
            {"_id": 0}
        ).sort("verification_count", -1).to_list(200)
        
        return {"translations": translations, "count": len(translations)}
    
    # ============ FESTIVAL MANAGEMENT ============
    
    @admin_router.get("/festivals")
    async def get_festivals(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get all festivals"""
        await verify_admin(credentials)
        
        festivals = await db.festivals.find({}, {"_id": 0}).sort("date", 1).to_list(100)
        return {"festivals": festivals}
    
    @admin_router.post("/festivals")
    async def create_festival(
        festival: FestivalEntry,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Create a new festival entry"""
        await verify_admin(credentials)
        
        festival_dict = festival.model_dump()
        festival_dict["created_at"] = datetime.now(timezone.utc)
        
        await db.festivals.insert_one(festival_dict)
        
        return {"message": "Festival created", "festival": festival_dict}
    
    @admin_router.put("/festivals/{festival_id}")
    async def update_festival(
        festival_id: str,
        updates: dict,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Update a festival entry"""
        await verify_admin(credentials)
        
        result = await db.festivals.update_one(
            {"id": festival_id},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Festival not found")
        
        return {"message": "Festival updated"}
    
    @admin_router.delete("/festivals/{festival_id}")
    async def delete_festival(
        festival_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Delete a festival entry"""
        await verify_admin(credentials)
        
        result = await db.festivals.delete_one({"id": festival_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Festival not found")
        
        return {"message": "Festival deleted"}
    
    # ============ DASHBOARD STATS ============
    
    @admin_router.get("/dashboard")
    async def get_dashboard_stats(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get admin dashboard overview"""
        await verify_admin(credentials)
        
        # Total counts
        total_users = await db.users.count_documents({})
        total_households = await db.households.count_documents({})
        total_inventory_items = await db.inventory.count_documents({})
        
        # Active users (logged in last 7 days)
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        # This would require tracking last_login, for now use created_at
        new_users_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
        new_households_week = await db.households.count_documents({"created_at": {"$gte": week_ago}})
        
        # Translation stats
        total_translations = await db.translations.count_documents({})
        verified_translations = await db.translations.count_documents({"user_verified": True})
        community_verified = await db.translations.count_documents({"verification_count": {"$gte": 100}})
        
        # Upcoming festivals
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        upcoming_festivals = await db.festivals.find(
            {"date": {"$gte": today}, "is_active": True},
            {"_id": 0}
        ).sort("date", 1).limit(5).to_list(5)
        
        return {
            "users": {
                "total": total_users,
                "new_this_week": new_users_week
            },
            "households": {
                "total": total_households,
                "new_this_week": new_households_week
            },
            "inventory": {
                "total_items": total_inventory_items
            },
            "translations": {
                "total": total_translations,
                "user_verified": verified_translations,
                "community_verified": community_verified
            },
            "upcoming_festivals": upcoming_festivals
        }
    
    @admin_router.post("/make-admin/{user_id}")
    async def make_admin(
        user_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Grant admin privileges to a user"""
        admin = await verify_admin(credentials)
        
        result = await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_admin": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "Admin privileges granted"}
    
    return admin_router

# ============ HELPER TO LOG API USAGE ============

async def log_api_usage(db, api_name: str, endpoint: str, units: int, household_id: str = None, user_id: str = None):
    """Log API usage for monitoring"""
    await db.api_usage.insert_one({
        "id": str(uuid.uuid4()),
        "api_name": api_name,
        "endpoint": endpoint,
        "units_used": units,
        "household_id": household_id,
        "user_id": user_id,
        "timestamp": datetime.now(timezone.utc)
    })
