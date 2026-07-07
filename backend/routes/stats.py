"""
Public aggregate stats for Rasoi-Sync.

One endpoint, no auth: the Home page shows "N families are cooking with
Rasoi-Sync" as social proof / motivation. Only whole-number aggregates
leave this endpoint — no names, emails, household details, or anything
traceable to a person — which is why it's safe to serve unauthenticated
(it also renders on screens shown before login).
"""
from fastapi import APIRouter

stats_router = APIRouter(prefix="/api", tags=["Stats"])


def create_stats_routes(db):
    """Factory — mirrors the other route modules' wiring pattern."""

    @stats_router.get("/stats/public")
    async def get_public_stats():
        # Plain count_documents everywhere: at current scale (hundreds of
        # rows) these four counts are single-digit milliseconds combined.
        # If this ever shows up in profiles, cache with a 5-minute TTL —
        # motivation numbers don't need to be realtime.
        users = await db.users.count_documents({})
        households = await db.households.count_documents({})
        recipes = await db.user_recipes.count_documents({})
        meal_plans = await db.meal_plans.count_documents({})
        return {
            "users": users,
            "families": households,
            "recipes_created": recipes,
            "meals_planned": meal_plans,
        }

    return stats_router
