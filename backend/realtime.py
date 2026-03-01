"""
Server-Sent Events (SSE) Module for Real-time Updates
- Real-time inventory and shopping list synchronization
- Shopping item status flow: Pending → In-Cart → Bought
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Set, AsyncGenerator, Any
import asyncio
import json
from datetime import datetime, timezone
from bson import ObjectId

# Security
security = HTTPBearer(auto_error=False)

# Router
sse_router = APIRouter(prefix="/api/sse", tags=["Real-time"])

# Active connections per household
# Structure: {household_id: {connection_id: queue}}
household_connections: Dict[str, Dict[str, asyncio.Queue]] = {}

# Event types
EVENT_TYPES = {
    "INVENTORY_UPDATE": "inventory_update",
    "INVENTORY_ADD": "inventory_add",
    "INVENTORY_DELETE": "inventory_delete",
    "SHOPPING_UPDATE": "shopping_update",
    "SHOPPING_ADD": "shopping_add",
    "SHOPPING_DELETE": "shopping_delete",
    "SHOPPING_STATUS": "shopping_status",  # Status change: pending/in_cart/bought
    "MEAL_PLAN_UPDATE": "meal_plan_update",
    "MEMBER_JOINED": "member_joined",
    "MEMBER_LEFT": "member_left",
}

# Shopping item statuses
SHOPPING_STATUS = {
    "PENDING": "pending",
    "IN_CART": "in_cart",  # Someone is buying this
    "BOUGHT": "bought"
}

# ============ JSON SERIALIZATION HELPER ============

def serialize_for_json(obj: Any) -> Any:
    """Recursively convert ObjectIds to strings for JSON serialization"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: serialize_for_json(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_json(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

# ============ CONNECTION MANAGEMENT ============

def register_connection(household_id: str, connection_id: str) -> asyncio.Queue:
    """Register a new SSE connection for a household"""
    if household_id not in household_connections:
        household_connections[household_id] = {}
    
    queue = asyncio.Queue()
    household_connections[household_id][connection_id] = queue
    return queue

def unregister_connection(household_id: str, connection_id: str):
    """Remove a disconnected SSE connection"""
    if household_id in household_connections:
        if connection_id in household_connections[household_id]:
            del household_connections[household_id][connection_id]
        if not household_connections[household_id]:
            del household_connections[household_id]

async def broadcast_to_household(household_id: str, event_type: str, data: dict, exclude_connection: str = None):
    """Broadcast an event to all connections in a household"""
    if household_id not in household_connections:
        return
    
    # Serialize data to handle ObjectIds and other non-JSON types
    serialized_data = serialize_for_json(data)
    
    message = {
        "type": event_type,
        "data": serialized_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    for conn_id, queue in household_connections[household_id].items():
        if conn_id != exclude_connection:
            try:
                await queue.put(message)
            except Exception:
                pass  # Connection might be closed

def get_connection_count(household_id: str) -> int:
    """Get number of active connections for a household"""
    return len(household_connections.get(household_id, {}))

# ============ SSE GENERATOR ============

async def event_generator(household_id: str, connection_id: str, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Generate SSE events for a client"""
    try:
        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'connection_id': connection_id, 'household_id': household_id})}\n\n"
        
        # Keep-alive and event loop
        while True:
            try:
                # Wait for message with timeout for keep-alive
                message = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"event: {message['type']}\ndata: {json.dumps(message)}\n\n"
            except asyncio.TimeoutError:
                # Send keep-alive ping
                yield f"event: ping\ndata: {json.dumps({'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unregister_connection(household_id, connection_id)

# ============ ROUTES ============

def create_sse_routes(db, decode_token_func):
    """Factory function to create SSE routes with database access"""
    
    async def get_user_household(credentials: HTTPAuthorizationCredentials):
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_token_func(credentials.credentials)
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.get("active_household"):
            raise HTTPException(status_code=400, detail="No active household selected")
        return user, user["active_household"]
    
    @sse_router.get("/stream")
    async def sse_stream(request: Request, token: str):
        """
        SSE endpoint for real-time updates
        Usage: EventSource('/api/sse/stream?token=<jwt_token>')
        """
        # Decode token
        try:
            payload = decode_token_func(token)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        household_id = user.get("active_household")
        if not household_id:
            raise HTTPException(status_code=400, detail="No active household")
        
        # Generate unique connection ID
        import uuid
        connection_id = str(uuid.uuid4())
        
        # Register connection
        queue = register_connection(household_id, connection_id)
        
        # Notify others about new connection
        await broadcast_to_household(
            household_id,
            "member_online",
            {"user_id": user_id, "name": user["name"]},
            exclude_connection=connection_id
        )
        
        return StreamingResponse(
            event_generator(household_id, connection_id, queue),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    @sse_router.get("/status")
    async def get_sse_status(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ):
        """Get SSE connection status for current household"""
        user, household_id = await get_user_household(credentials)
        
        return {
            "household_id": household_id,
            "active_connections": get_connection_count(household_id),
            "all_households": {k: len(v) for k, v in household_connections.items()}
        }
    
    return sse_router

# ============ BROADCAST HELPERS ============

async def notify_inventory_change(household_id: str, action: str, item: dict, user_name: str = None):
    """Notify household members about inventory changes"""
    event_type = {
        "add": EVENT_TYPES["INVENTORY_ADD"],
        "update": EVENT_TYPES["INVENTORY_UPDATE"],
        "delete": EVENT_TYPES["INVENTORY_DELETE"]
    }.get(action, EVENT_TYPES["INVENTORY_UPDATE"])
    
    await broadcast_to_household(household_id, event_type, {
        "action": action,
        "item": item,
        "by": user_name
    })

async def notify_shopping_change(household_id: str, action: str, item: dict, user_name: str = None):
    """Notify household members about shopping list changes"""
    event_type = {
        "add": EVENT_TYPES["SHOPPING_ADD"],
        "update": EVENT_TYPES["SHOPPING_UPDATE"],
        "delete": EVENT_TYPES["SHOPPING_DELETE"],
        "status": EVENT_TYPES["SHOPPING_STATUS"]
    }.get(action, EVENT_TYPES["SHOPPING_UPDATE"])
    
    await broadcast_to_household(household_id, event_type, {
        "action": action,
        "item": item,
        "by": user_name
    })

async def notify_meal_plan_change(household_id: str, action: str, meal: dict, user_name: str = None):
    """Notify household members about meal plan changes"""
    await broadcast_to_household(household_id, EVENT_TYPES["MEAL_PLAN_UPDATE"], {
        "action": action,
        "meal": meal,
        "by": user_name
    })

async def notify_household(household_id: str, event_type: str, data: dict):
    """Generic notification for household members - used for recipes and other events"""
    await broadcast_to_household(household_id, event_type, data)
