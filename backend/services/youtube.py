"""
YouTube Service for Rasoi-Sync
Handles YouTube API calls with caching for quota efficiency
"""
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from data.recipes import RECIPE_DATABASE

logger = logging.getLogger(__name__)


def normalize_string(s: str) -> str:
    """Normalize string for flexible matching"""
    return re.sub(r'[^a-z0-9]', '', s.lower())


def search_local_recipes(
    ingredients: List[str],
    videos_only: bool = False,
    favorite_channels: List[str] = [],
    text_query: str = ""
) -> List[Dict[str, Any]]:
    """Search local recipe database by matching ingredients or text query"""
    results = []
    ingredients_lower = [ing.lower() for ing in ingredients]
    text_query_lower = text_query.lower().strip() if text_query else ""
    
    favorite_channels_normalized = [normalize_string(ch) for ch in favorite_channels]
    
    for recipe in RECIPE_DATABASE:
        if videos_only and recipe.get('type') != 'video':
            continue
        
        source_normalized = normalize_string(recipe.get('source', ''))
        
        is_from_favorite = bool(favorite_channels_normalized and any(
            fav in source_normalized or source_normalized in fav 
            for fav in favorite_channels_normalized
        ))
        
        # Text query search
        if text_query_lower:
            title_lower = recipe.get('title', '').lower()
            
            if text_query_lower in title_lower:
                base_score = 1.0 if text_query_lower == title_lower else 0.9
                results.append({
                    **recipe,
                    'match_count': 1,
                    'match_score': base_score + (0.5 if is_from_favorite else 0),
                    'is_favorite': is_from_favorite
                })
            elif title_lower in text_query_lower:
                results.append({
                    **recipe,
                    'match_count': 1,
                    'match_score': 0.8 + (0.5 if is_from_favorite else 0),
                    'is_favorite': is_from_favorite
                })
            continue
        
        # Ingredient-based search
        if ingredients_lower:
            if favorite_channels and not is_from_favorite:
                continue
                
            recipe_ingredients_lower = [ing.lower() for ing in recipe.get('ingredients', [])]
            matches = sum(1 for ing in ingredients_lower if any(ing in r_ing or r_ing in ing for r_ing in recipe_ingredients_lower))
            
            if matches > 0:
                match_score = matches / len(ingredients_lower) if ingredients_lower else 0
                results.append({
                    **recipe,
                    'match_count': matches,
                    'match_score': match_score,
                    'is_favorite': is_from_favorite
                })
    
    results.sort(key=lambda x: (x['match_score'], x['is_favorite']), reverse=True)
    return results


def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_ingredients_from_description(description: str) -> List[str]:
    """Basic ingredient extraction from video description"""
    common_ingredients = [
        "onion", "tomato", "potato", "garlic", "ginger", "chili", "turmeric",
        "cumin", "coriander", "garam masala", "salt", "oil", "ghee", "butter",
        "rice", "dal", "paneer", "chicken", "mutton", "fish", "egg",
        "carrot", "peas", "cauliflower", "capsicum", "spinach", "methi",
        "milk", "cream", "curd", "yogurt", "coconut", "tamarind",
        "mustard", "curry leaves", "bay leaf", "cinnamon", "cardamom", "cloves"
    ]
    
    desc_lower = description.lower()
    ingredients = [ing.title() for ing in common_ingredients if ing in desc_lower]
    return ingredients[:10]


def calculate_inventory_match(recipe_ingredients: List[str], user_inventory: List[str]) -> dict:
    """Calculate how many recipe ingredients the user has"""
    if not recipe_ingredients:
        return {"matched": 0, "total": 0, "percentage": 0, "matched_items": [], "missing_items": []}
    
    user_inv_lower = [i.lower() for i in user_inventory]
    matched = []
    missing = []
    
    for ing in recipe_ingredients:
        ing_lower = ing.lower()
        found = any(inv in ing_lower or ing_lower in inv for inv in user_inv_lower)
        if found:
            matched.append(ing)
        else:
            missing.append(ing)
    
    total = len(recipe_ingredients)
    return {
        "matched": len(matched),
        "total": total,
        "percentage": round((len(matched) / total) * 100) if total > 0 else 0,
        "matched_items": matched,
        "missing_items": missing
    }


def match_ingredients_in_text(text: str, inventory_items: List[str], min_matches: int = 2) -> Dict[str, Any]:
    """Case-insensitive regex match of inventory items against text"""
    text_lower = text.lower()
    matched_items = []
    
    for item in inventory_items:
        item_lower = item.lower()
        pattern = r'\b' + re.escape(item_lower) + r'\b'
        if re.search(pattern, text_lower) or item_lower in text_lower:
            matched_items.append(item)
    
    match_count = len(matched_items)
    return {
        "matched_count": match_count,
        "matched_items": matched_items,
        "meets_threshold": match_count >= min_matches,
        "match_percentage": round((match_count / len(inventory_items)) * 100) if inventory_items else 0
    }


class YouTubeService:
    """Service for handling YouTube API calls with caching"""
    
    def __init__(self, api_key: str, db, log_api_usage_func=None):
        self.api_key = api_key
        self.db = db
        self.log_api_usage = log_api_usage_func
    
    def get_youtube_service(self):
        return build('youtube', 'v3', developerKey=self.api_key, cache_discovery=False)
    
    async def fetch_video_details(
        self,
        video_id: str,
        household_id: str = None,
        user_id: str = None
    ) -> Dict[str, Any]:
        """Fetch YouTube video details"""
        try:
            youtube = self.get_youtube_service()
            request = youtube.videos().list(part="snippet", id=video_id)
            response = request.execute()
            
            if self.log_api_usage:
                await self.log_api_usage(self.db, "youtube", "videos.list", 1, household_id, user_id)
            
            if response.get('items'):
                item = response['items'][0]
                return {
                    'title': item['snippet']['title'],
                    'thumbnail': item['snippet']['thumbnails']['high']['url'],
                    'video_id': video_id
                }
            return {}
        except HttpError as e:
            logger.error(f"YouTube API error: {e}")
            return {}
    
    async def search_recipes(
        self,
        query: str,
        max_results: int = 10,
        favorite_channels: List[str] = [],
        household_id: str = None,
        user_id: str = None
    ) -> List[Dict[str, Any]]:
        """Search YouTube for recipe videos"""
        try:
            youtube = self.get_youtube_service()
            all_results = []
            seen_video_ids = set()
            search_count = 0
            
            if favorite_channels:
                channels_query = " OR ".join([f'"{ch}"' for ch in favorite_channels[:3]])
                search_query = f"{query} recipe ({channels_query})"
                
                request = youtube.search().list(
                    part="snippet",
                    q=search_query,
                    type="video",
                    maxResults=max_results * 2,
                    regionCode="IN"
                )
                response = request.execute()
                search_count += 1
                
                favorite_names_lower = [ch.lower() for ch in favorite_channels]
                
                for item in response.get('items', []):
                    video_id = item['id']['videoId']
                    channel_title = item['snippet']['channelTitle'].lower()
                    
                    is_favorite = any(
                        fav in channel_title or channel_title in fav 
                        for fav in favorite_names_lower
                    )
                    
                    if is_favorite and video_id not in seen_video_ids:
                        seen_video_ids.add(video_id)
                        all_results.append({
                            'video_id': video_id,
                            'title': item['snippet']['title'],
                            'thumbnail': item['snippet']['thumbnails']['high']['url'],
                            'channel': item['snippet']['channelTitle'],
                            'channel_id': item['snippet']['channelId'],
                            'is_favorite': True
                        })
                        
                        if len(all_results) >= max_results:
                            break
            else:
                request = youtube.search().list(
                    part="snippet",
                    q=f"{query} recipe",
                    type="video",
                    maxResults=max_results,
                    regionCode="IN"
                )
                response = request.execute()
                search_count += 1
                
                for item in response.get('items', []):
                    video_id = item['id']['videoId']
                    if video_id not in seen_video_ids:
                        seen_video_ids.add(video_id)
                        all_results.append({
                            'video_id': video_id,
                            'title': item['snippet']['title'],
                            'thumbnail': item['snippet']['thumbnails']['high']['url'],
                            'channel': item['snippet']['channelTitle'],
                            'channel_id': item['snippet']['channelId'],
                            'is_favorite': False
                        })
            
            if self.log_api_usage and search_count > 0:
                await self.log_api_usage(
                    self.db, "youtube", "search.list",
                    100 * search_count, household_id, user_id
                )
            
            return all_results[:max_results]
            
        except HttpError as e:
            logger.error(f"YouTube search error: {e}")
            return []
    
    async def get_channel_upload_playlist(self, channel_name: str) -> Optional[Dict[str, Any]]:
        """Get channel info including upload playlist ID"""
        try:
            youtube = self.get_youtube_service()
            
            search_request = youtube.search().list(
                part="snippet",
                q=channel_name,
                type="channel",
                maxResults=1
            )
            search_response = search_request.execute()
            
            if not search_response.get('items'):
                return None
            
            channel_id = search_response['items'][0]['snippet']['channelId']
            channel_title = search_response['items'][0]['snippet']['title']
            channel_thumbnail = search_response['items'][0]['snippet']['thumbnails'].get('default', {}).get('url', '')
            
            channel_request = youtube.channels().list(
                part="contentDetails,snippet",
                id=channel_id
            )
            channel_response = channel_request.execute()
            
            if not channel_response.get('items'):
                return None
            
            channel_data = channel_response['items'][0]
            uploads_playlist_id = channel_data['contentDetails']['relatedPlaylists']['uploads']
            
            return {
                "channel_id": channel_id,
                "channel_name": channel_title,
                "thumbnail": channel_thumbnail,
                "uploads_playlist_id": uploads_playlist_id
            }
            
        except HttpError as e:
            logger.error(f"Error fetching channel info: {e}")
            return None
    
    async def get_playlist_videos(self, playlist_id: str, max_results: int = 20) -> List[Dict[str, Any]]:
        """Get videos from a playlist"""
        try:
            youtube = self.get_youtube_service()
            
            request = youtube.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=playlist_id,
                maxResults=max_results
            )
            response = request.execute()
            
            videos = []
            for item in response.get('items', []):
                snippet = item['snippet']
                videos.append({
                    "video_id": snippet['resourceId']['videoId'],
                    "title": snippet['title'],
                    "description": snippet.get('description', '')[:500],
                    "channel": snippet['channelTitle'],
                    "channel_id": snippet['channelId'],
                    "thumbnail": snippet['thumbnails'].get('high', snippet['thumbnails'].get('medium', {})).get('url', ''),
                    "published_at": snippet['publishedAt']
                })
            
            return videos
            
        except HttpError as e:
            logger.error(f"Error fetching playlist videos: {e}")
            return []
