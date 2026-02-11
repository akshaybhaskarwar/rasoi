"""
Pantry Items API Routes
Serves centralized pantry item data for frontend and internal use.
"""
from fastapi import APIRouter

pantry_router = APIRouter(prefix="/api/pantry-items", tags=["Pantry Items"])


def create_pantry_routes(pantry_data):
    """Factory function to create pantry item routes"""
    
    @pantry_router.get("/template")
    async def get_pantry_template():
        """Get the full pantry template for the Indian Pantry Template UI"""
        from data.pantry_items import get_pantry_template_for_frontend, CATEGORY_UNITS
        
        return {
            "template": get_pantry_template_for_frontend(),
            "category_units": CATEGORY_UNITS
        }
    
    @pantry_router.get("/essentials")
    async def get_essentials():
        """Get the essentials pack for new kitchen setup"""
        from data.pantry_items import get_essentials_pack
        
        return {
            "essentials": get_essentials_pack()
        }
    
    @pantry_router.get("/item/{item_name}")
    async def get_item_details(item_name: str):
        """Get details for a specific item by name"""
        from data.pantry_items import get_item_details
        
        details = get_item_details(item_name)
        if not details:
            return {"error": "Item not found", "item_name": item_name}
        
        return details
    
    @pantry_router.get("/categories")
    async def get_categories():
        """Get list of all categories with their default units"""
        from data.pantry_items import CATEGORY_UNITS
        
        return {
            "categories": CATEGORY_UNITS
        }
    
    return pantry_router
