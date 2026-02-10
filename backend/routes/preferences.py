"""
User preferences routes for Rasoi-Sync
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

preferences_router = APIRouter(prefix="/api", tags=["Preferences"])


def create_preferences_routes(db):
    """Factory function to create preferences routes with database access"""

    @preferences_router.get("/preferences")
    async def get_preferences():
        """Get user preferences"""
        prefs = await db.preferences.find_one({}, {"_id": 0})
        if not prefs:
            return {"favorite_channels": []}
        return prefs

    @preferences_router.put("/preferences")
    async def update_preferences(preferences: dict):
        """Update user preferences"""
        preferences['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.preferences.update_one(
            {},
            {"$set": preferences},
            upsert=True
        )
        
        return {"message": "Preferences updated successfully"}

    @preferences_router.get("/preferences/favorite-channels")
    async def get_favorite_channels():
        """Get favorite channels"""
        prefs = await db.preferences.find_one({}, {"_id": 0})
        if not prefs:
            return {"favorite_channels": []}
        return {"favorite_channels": prefs.get('favorite_channels', [])}

    @preferences_router.post("/preferences/favorite-channels")
    async def add_favorite_channel(channel_data: dict):
        """Add a favorite channel"""
        channel_id = channel_data.get('channel_id')
        channel_name = channel_data.get('channel_name')
        
        if not channel_id or not channel_name:
            raise HTTPException(status_code=400, detail="Channel ID and name required")
        
        prefs = await db.preferences.find_one({})
        if not prefs:
            prefs = {"favorite_channels": []}
        
        channel_entry = {"id": channel_id, "name": channel_name}
        if not any(ch.get('id') == channel_id for ch in prefs.get('favorite_channels', [])):
            prefs['favorite_channels'].append(channel_entry)
            prefs['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            await db.preferences.update_one(
                {},
                {"$set": prefs},
                upsert=True
            )
        
        return {"message": "Channel added to favorites"}

    @preferences_router.delete("/preferences/favorite-channels/{channel_id}")
    async def remove_favorite_channel(channel_id: str):
        """Remove a favorite channel"""
        result = await db.preferences.update_one(
            {},
            {"$pull": {"favorite_channels": {"id": channel_id}}}
        )
        
        if result.modified_count > 0:
            return {"message": "Channel removed from favorites"}
        else:
            raise HTTPException(status_code=404, detail="Channel not found in favorites")

    return preferences_router
