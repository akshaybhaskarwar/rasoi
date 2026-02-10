"""
Routes module for Rasoi-Sync
"""
from .inventory import create_inventory_routes, inventory_router
from .shopping import create_shopping_routes, shopping_router
from .meal_plans import create_meal_plan_routes, meal_plans_router
from .translation import create_translation_routes, translation_router
from .youtube import create_youtube_routes, youtube_router
from .preferences import create_preferences_routes, preferences_router
from .barcode import create_barcode_routes, barcode_router

__all__ = [
    'create_inventory_routes', 'inventory_router',
    'create_shopping_routes', 'shopping_router',
    'create_meal_plan_routes', 'meal_plans_router',
    'create_translation_routes', 'translation_router',
    'create_youtube_routes', 'youtube_router',
    'create_preferences_routes', 'preferences_router',
    'create_barcode_routes', 'barcode_router',
]
