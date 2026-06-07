"""
Default favorite YouTube channels seeded for users on first access.

Channel names must match the `source` field used in RECIPE_DATABASE
(backend/data/recipes.py) so that the favorite-channel match logic in
services/youtube.py can surface recipes from these channels immediately.

Edit this list to change which channels every new user starts with.
Use stable, prefixed `id`s so they don't collide with user-added IDs
(which the frontend builds via slugifying the channel name).
"""

DEFAULT_FAVORITE_CHANNELS = [
    {"id": "default_madhura", "name": "Madhura's Recipe Marathi"},
    {"id": "default_ranveer", "name": "Ranveer Brar"},
    {"id": "default_kabita",  "name": "Kabita's Kitchen"},
    {"id": "default_sanjeev", "name": "Sanjeev Kapoor"},
    {"id": "default_hebbars", "name": "Hebbars Kitchen"},
]
