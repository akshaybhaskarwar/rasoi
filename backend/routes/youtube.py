"""
YouTube routes for Rasoi-Sync
Includes recipe search, discovery, and personalized stream
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import re
import logging

from models.common import YouTubeSearchRequest, YouTubeVideoSubmission
from models.recipes import Recipe, RecipeCreate
from data.recipes import RECIPE_DATABASE, DADIS_RECOMMENDATIONS
from services.youtube import (
    search_local_recipes, extract_video_id, extract_ingredients_from_description,
    calculate_inventory_match, match_ingredients_in_text
)

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
youtube_router = APIRouter(prefix="/api", tags=["YouTube"])


def create_youtube_routes(db, decode_token, youtube_service, log_api_usage):
    """Factory function to create YouTube routes with database access"""
    
    async def get_user_from_token(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    # ============ LEGACY RECIPE COMMUNITY ENDPOINTS ============
    
    @youtube_router.post("/youtube-recipes", response_model=Recipe)
    async def create_youtube_recipe(recipe: RecipeCreate):
        """Post a YouTube recipe to community (legacy endpoint)"""
        video_id = recipe.youtube_url.split('v=')[-1].split('&')[0]
        
        recipe_dict = recipe.model_dump()
        recipe_obj = Recipe(**recipe_dict, youtube_video_id=video_id)
        
        video_details = await youtube_service.fetch_video_details(video_id)
        recipe_obj.youtube_thumbnail = video_details.get('thumbnail')
        
        doc = recipe_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.recipes.insert_one(doc)
        return recipe_obj

    @youtube_router.get("/youtube-recipes", response_model=List[Recipe])
    async def get_youtube_recipes():
        """Get YouTube community recipes (legacy endpoint)"""
        recipes = await db.recipes.find({}, {"_id": 0}).to_list(1000)
        
        for recipe in recipes:
            if isinstance(recipe.get('created_at'), str):
                recipe['created_at'] = datetime.fromisoformat(recipe['created_at'])
        
        return recipes

    # ============ YOUTUBE SEARCH ENDPOINTS ============

    @youtube_router.get("/youtube/search")
    async def search_recipes(query: str, max_results: int = 10, favorite_channels: str = ""):
        """Search YouTube for recipes with favorite channel priority"""
        channels_list = [ch.strip() for ch in favorite_channels.split(',') if ch.strip()] if favorite_channels else []
        results = await youtube_service.search_recipes(query, max_results, channels_list)
        return {"results": results}

    @youtube_router.get("/youtube-recipes/search")
    async def search_local_recipes_endpoint(
        ingredients: str = "",
        videos_only: bool = False,
        favorite_channels: str = "",
        max_results: int = 20,
        query: str = ""
    ):
        """Search local recipe database by ingredients or text query"""
        ingredients_list = [ing.strip() for ing in ingredients.split(',') if ing.strip()] if ingredients else []
        channels_list = [ch.strip() for ch in favorite_channels.split(',') if ch.strip()] if favorite_channels else []
        
        results = search_local_recipes(ingredients_list, videos_only, channels_list, query.strip())
        limited_results = results[:max_results]
        
        return {
            "results": limited_results,
            "total_found": len(results),
            "search_criteria": {
                "ingredients": ingredients_list,
                "videos_only": videos_only,
                "favorite_channels": channels_list
            }
        }

    @youtube_router.get("/youtube/recommendations")
    async def get_dadi_recommendations():
        """Get pre-fetched Dadi's Recommended videos - NO API calls"""
        return {
            "recommendations": DADIS_RECOMMENDATIONS,
            "source": "pre_fetched",
            "quota_cost": 0
        }

    @youtube_router.post("/youtube/search")
    async def youtube_recipe_search(request: YouTubeSearchRequest):
        """Cache-First YouTube Recipe Search"""
        cache_key = f"{','.join(sorted(request.ingredients))}_{request.text_query}".lower().strip()
        if not cache_key or cache_key == "_":
            raise HTTPException(status_code=400, detail="Please provide ingredients or search text")
        
        # Check cache first
        cached = await db.search_cache.find_one({
            "cache_key": cache_key,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        if cached:
            logger.info(f"Cache HIT for: {cache_key}")
            inventory_items = await db.inventory.find({}, {"name_en": 1, "_id": 0}).to_list(100)
            user_inventory = [item["name_en"] for item in inventory_items]
            
            results_with_match = []
            for video in cached.get("results", []):
                match_info = calculate_inventory_match(video.get("ingredients", []), user_inventory)
                results_with_match.append({**video, "inventory_match": match_info})
            
            return {
                "results": results_with_match,
                "total": len(results_with_match),
                "source": "cache",
                "quota_cost": 0,
                "cache_expires": cached.get("expires_at").isoformat() if cached.get("expires_at") else None
            }
        
        # Cache MISS - search locally first
        logger.info(f"Cache MISS for: {cache_key}")
        
        # Search local database
        local_results = search_local_recipes(request.ingredients, False, [], request.text_query)
        
        if local_results:
            inventory_items = await db.inventory.find({}, {"name_en": 1, "_id": 0}).to_list(100)
            user_inventory = [item["name_en"] for item in inventory_items]
            
            results_with_match = []
            for video in local_results[:request.max_results]:
                match_info = calculate_inventory_match(video.get("ingredients", []), user_inventory)
                results_with_match.append({**video, "inventory_match": match_info})
            
            return {
                "results": results_with_match,
                "total": len(results_with_match),
                "source": "local_database",
                "quota_cost": 0
            }
        
        return {
            "results": [],
            "total": 0,
            "source": "local_database",
            "quota_cost": 0,
            "message": "No matching recipes found"
        }

    @youtube_router.get("/youtube/video-details/{video_id}")
    async def get_youtube_video_details(
        video_id: str,
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get YouTube video details by video ID"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household") if user else None
        
        video_details = await youtube_service.fetch_video_details(video_id, household_id, user.get("id"))
        
        if not video_details:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return video_details

    @youtube_router.post("/youtube/add-video")
    async def add_user_video(submission: YouTubeVideoSubmission):
        """Add user-submitted YouTube video"""
        video_id = extract_video_id(submission.youtube_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        existing = await db.user_videos.find_one({"video_id": video_id})
        if existing:
            return {"success": True, "video": existing, "message": "Video already saved", "quota_cost": 0}
        
        video_details = await youtube_service.fetch_video_details(video_id)
        
        if not video_details:
            raise HTTPException(status_code=404, detail="Video not found")
        
        video_doc = {
            "id": str(__import__('uuid').uuid4()),
            "video_id": video_id,
            "title": video_details.get('title', ''),
            "thumbnail": video_details.get('thumbnail', ''),
            "source": "user_submitted",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.user_videos.insert_one(video_doc)
        video_doc.pop('_id', None)
        
        return {
            "success": True,
            "video": video_doc,
            "message": "Video added successfully",
            "quota_cost": 1
        }

    @youtube_router.get("/youtube/user-videos")
    async def get_user_videos():
        """Get all user-submitted videos"""
        videos = await db.user_videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
        return {"videos": videos, "total": len(videos)}

    @youtube_router.delete("/youtube/user-videos/{video_id}")
    async def delete_user_video(video_id: str):
        """Delete a user-submitted video"""
        result = await db.user_videos.delete_one({"video_id": video_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Video not found")
        return {"success": True, "message": "Video deleted"}

    @youtube_router.get("/youtube/cache-stats")
    async def get_cache_stats():
        """Get cache statistics for monitoring"""
        total_cached = await db.search_cache.count_documents({})
        active_cached = await db.search_cache.count_documents({
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        return {
            "total_cached_searches": total_cached,
            "active_cache_entries": active_cached,
            "cache_ttl_hours": 24
        }

    # ============ PERSONALIZED RECIPE STREAM ============

    @youtube_router.get("/stream/channels")
    async def get_favorite_channels_with_info(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get favorite channels with their YouTube info"""
        user = await get_user_from_token(credentials)
        household_id = user.get("active_household") if user else None
        
        prefs_query = {"household_id": household_id} if household_id else {}
        prefs = await db.preferences.find_one(prefs_query, {"_id": 0})
        
        if not prefs:
            prefs = await db.preferences.find_one({}, {"_id": 0})
        
        favorite_channels = prefs.get('favorite_channels', []) if prefs else []
        
        if not favorite_channels:
            return {"channels": [], "message": "No favorite channels set"}
        
        channels_with_info = []
        
        for channel in favorite_channels:
            channel_name = channel.get('name', '')
            
            cached = await db.channel_info_cache.find_one({
                "channel_name_lower": channel_name.lower(),
                "expires_at": {"$gt": datetime.now(timezone.utc)}
            })
            
            if cached:
                channels_with_info.append({
                    "id": channel.get('id'),
                    "name": channel_name,
                    "channel_id": cached.get('channel_id'),
                    "thumbnail": cached.get('thumbnail'),
                    "uploads_playlist_id": cached.get('uploads_playlist_id')
                })
            else:
                channel_info = await youtube_service.get_channel_upload_playlist(channel_name)
                if channel_info:
                    cache_doc = {
                        "channel_name_lower": channel_name.lower(),
                        "channel_id": channel_info['channel_id'],
                        "channel_name": channel_info['channel_name'],
                        "thumbnail": channel_info['thumbnail'],
                        "uploads_playlist_id": channel_info['uploads_playlist_id'],
                        "created_at": datetime.now(timezone.utc),
                        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
                    }
                    await db.channel_info_cache.update_one(
                        {"channel_name_lower": channel_name.lower()},
                        {"$set": cache_doc},
                        upsert=True
                    )
                    
                    channels_with_info.append({
                        "id": channel.get('id'),
                        "name": channel_name,
                        "channel_id": channel_info['channel_id'],
                        "thumbnail": channel_info['thumbnail'],
                        "uploads_playlist_id": channel_info['uploads_playlist_id']
                    })
                else:
                    channels_with_info.append({
                        "id": channel.get('id'),
                        "name": channel_name,
                        "channel_id": None,
                        "thumbnail": None,
                        "uploads_playlist_id": None
                    })
        
        return {"channels": channels_with_info}

    @youtube_router.get("/stream/feed")
    async def get_personalized_recipe_stream(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        channel_filter: Optional[str] = None,
        min_matches: int = 2,
        max_videos_per_channel: int = 15
    ):
        """Get personalized recipe feed from favorite channels"""
        user = await get_user_from_token(credentials)
        
        if not user:
            return {"feed": [], "message": "User not found", "quota_cost": 0}
        
        household_id = user.get("active_household")
        
        query = {"stock_level": {"$ne": "empty"}}
        if household_id:
            query["household_id"] = household_id
        
        inventory_items = await db.inventory.find(query, {"name_en": 1, "_id": 0}).to_list(100)
        user_inventory = [item["name_en"] for item in inventory_items if item.get("name_en")]
        
        if not user_inventory:
            return {
                "feed": [],
                "message": "Add items to your inventory to see personalized recipes",
                "quota_cost": 0
            }
        
        prefs_query = {"household_id": household_id} if household_id else {}
        prefs = await db.preferences.find_one(prefs_query, {"_id": 0})
        
        if not prefs:
            prefs = await db.preferences.find_one({}, {"_id": 0})
        
        favorite_channels = prefs.get('favorite_channels', []) if prefs else []
        
        if not favorite_channels:
            return {
                "feed": [],
                "message": "Add favorite channels to see personalized recipes",
                "quota_cost": 0
            }
        
        if channel_filter:
            favorite_channels = [ch for ch in favorite_channels if ch.get('id') == channel_filter or ch.get('name', '').lower() == channel_filter.lower()]
        
        matched_videos = []
        quota_used = 0
        
        for channel in favorite_channels:
            channel_name = channel.get('name', '')
            
            cached_info = await db.channel_info_cache.find_one({
                "channel_name_lower": channel_name.lower()
            })
            
            playlist_id = None
            channel_thumbnail = None
            
            if cached_info and cached_info.get('uploads_playlist_id'):
                playlist_id = cached_info['uploads_playlist_id']
                channel_thumbnail = cached_info.get('thumbnail')
            else:
                channel_info = await youtube_service.get_channel_upload_playlist(channel_name)
                quota_used += 2
                if channel_info:
                    playlist_id = channel_info['uploads_playlist_id']
                    channel_thumbnail = channel_info['thumbnail']
                    await db.channel_info_cache.update_one(
                        {"channel_name_lower": channel_name.lower()},
                        {"$set": {
                            **channel_info,
                            "channel_name_lower": channel_name.lower(),
                            "created_at": datetime.now(timezone.utc),
                            "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
                        }},
                        upsert=True
                    )
            
            if not playlist_id:
                continue
            
            video_cache_key = f"playlist_{playlist_id}"
            cached_videos = await db.playlist_video_cache.find_one({
                "cache_key": video_cache_key,
                "expires_at": {"$gt": datetime.now(timezone.utc)}
            })
            
            if cached_videos:
                videos = cached_videos.get('videos', [])
            else:
                videos = await youtube_service.get_playlist_videos(playlist_id, max_videos_per_channel)
                quota_used += 1
                
                if videos:
                    await db.playlist_video_cache.update_one(
                        {"cache_key": video_cache_key},
                        {"$set": {
                            "cache_key": video_cache_key,
                            "playlist_id": playlist_id,
                            "videos": videos,
                            "created_at": datetime.now(timezone.utc),
                            "expires_at": datetime.now(timezone.utc) + timedelta(hours=6)
                        }},
                        upsert=True
                    )
            
            for video in videos:
                combined_text = f"{video['title']} {video.get('description', '')}"
                match_info = match_ingredients_in_text(combined_text, user_inventory, min_matches)
                
                if match_info['meets_threshold']:
                    matched_videos.append({
                        **video,
                        "channel_thumbnail": channel_thumbnail,
                        "inventory_match": {
                            "matched_count": match_info['matched_count'],
                            "matched_items": match_info['matched_items'],
                            "total_inventory": len(user_inventory),
                            "percentage": match_info['match_percentage']
                        }
                    })
        
        matched_videos.sort(key=lambda x: x['inventory_match']['percentage'], reverse=True)
        
        return {
            "feed": matched_videos,
            "total_matches": len(matched_videos),
            "inventory_items_used": len(user_inventory),
            "channels_checked": len(favorite_channels),
            "quota_cost": quota_used
        }

    @youtube_router.post("/stream/refresh")
    async def refresh_channel_feed(channel_name: Optional[str] = None):
        """Force refresh the feed cache"""
        if channel_name:
            await db.channel_info_cache.delete_one({"channel_name_lower": channel_name.lower()})
            cached_info = await db.channel_info_cache.find_one({"channel_name_lower": channel_name.lower()})
            if cached_info and cached_info.get('uploads_playlist_id'):
                await db.playlist_video_cache.delete_one({"playlist_id": cached_info['uploads_playlist_id']})
            return {"message": f"Cache cleared for {channel_name}"}
        else:
            await db.playlist_video_cache.delete_many({})
            return {"message": "All playlist caches cleared"}

    return youtube_router
