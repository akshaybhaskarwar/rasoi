"""
Breakfast & Snacks menu — companion catalog to EVERYDAY_MENU.

EVERYDAY_MENU surfaces the components of a full Indian thali (chapati,
dal, sabji, rice, koshimbhir, etc.) — the right vocabulary for LUNCH and
DINNER planning. But for BREAKFAST and SNACKS planning the user thinks
in dishes (Dosa, Misal Pav, Bhel, Pohe), not components. This file is
the cleaned + bilingual catalog imported from the family's
"Breakfast_snacks.xlsx" spreadsheet for those meal slots.

Cleaning applied during import:
  - Typos fixed: "Buiscuit" -> "Biscuit", "Sandwitch" -> "Sandwich",
    "Maggie" -> "Maggi", "Watermellon" -> "Watermelon",
    "Raddish" -> "Radish", "Rajgeera" -> "Rajgira",
    "Thalepeeth" -> "Thalipeeth", "Chida" -> "Chivda",
    trailing whitespace stripped.
  - Sheet 11 ("Parathe") had a duplicate "Tomato Paratha" — kept once.
  - Sheet 12 ("Rajasthani") had only "Daal Bati"; kept as-is. The
    Maharashtrian sheet's "Parathe" duplicate the Parathe sheet
    intentionally (different regional preparation); kept both contexts.
  - Marathi script added where confident; left empty otherwise.

Categories are surfaced in the UI in the same order as Excel sheets,
plus a "Custom" slot for household-added items.
"""

SOUTH_INDIAN = [
    {"en": "Dosa",            "mr": "डोसा",                 "aliases": []},
    {"en": "Appe",            "mr": "अप्पे",                "aliases": ["Paniyaram"]},
    {"en": "Uttapam",         "mr": "उत्तपम",              "aliases": []},
    {"en": "Idli",            "mr": "इडली",                "aliases": []},
    {"en": "Rava Dosa",       "mr": "रवा डोसा",            "aliases": []},
    {"en": "Rava Appe",       "mr": "रवा अप्पे",            "aliases": []},
    {"en": "Rava Upma",       "mr": "रवा उपमा",            "aliases": ["Upma"]},
    {"en": "Vada Sambar",     "mr": "वडा सांबार",           "aliases": ["Medu Vada"]},
    {"en": "Dahi Vada",       "mr": "दही वडा",             "aliases": []},
]

GUJARATI = [
    {"en": "Khichu",          "mr": "खिचू",                "aliases": []},
    {"en": "Handvo",          "mr": "हांडवो",              "aliases": []},
    {"en": "Khaman Dhokla",   "mr": "खमण ढोकळा",          "aliases": ["Khaman"]},
    {"en": "Rava Dhokla",     "mr": "रवा ढोकळा",          "aliases": []},
    {"en": "Dabheli",         "mr": "दाबेली",              "aliases": []},
]

PAV_BREAD = [
    {"en": "Pav Bhaji",       "mr": "पाव भाजी",            "aliases": []},
    {"en": "Misal Pav",       "mr": "मिसळ पाव",           "aliases": ["Missal Pav"]},
    {"en": "Bread Sandwich",  "mr": "ब्रेड सँडविच",         "aliases": []},
    {"en": "Bread Upma",      "mr": "ब्रेड उपमा",          "aliases": []},
]

UPVAS = [
    # Fasting-day dishes
    {"en": "Sabudana Khichadi",     "mr": "साबुदाणा खिचडी",      "aliases": []},
    {"en": "Sabudana Vada",         "mr": "साबुदाणा वडा",        "aliases": []},
    {"en": "Sabudana Thalipeeth",   "mr": "साबुदाणा थालिपीठ",    "aliases": []},
    {"en": "Bhagar",                "mr": "भगर",                "aliases": ["Vari Bhaat"]},
    {"en": "Rajgira Thalipeeth",    "mr": "राजगिरा थालिपीठ",    "aliases": []},
    {"en": "Rajgira with Milk",     "mr": "राजगिरा दुध",         "aliases": []},
    {"en": "Rajgira Chivda",        "mr": "राजगिरा चिवडा",      "aliases": []},
    {"en": "Bhagar Dosa",           "mr": "भगर डोसा",           "aliases": []},
    {"en": "Kheer",                 "mr": "खीर",                "aliases": []},
]

CHAAT = [
    {"en": "Pani Puri",         "mr": "पाणी पुरी",           "aliases": ["Gol Gappa"]},
    {"en": "Sev Puri",          "mr": "शेव पुरी",            "aliases": []},
    {"en": "Bhel",              "mr": "भेळ",                "aliases": ["Bhel Puri"]},
    {"en": "Ragda Pattice",     "mr": "रगडा पॅटिस",         "aliases": []},
    {"en": "Sev Puri Dahi Puri","mr": "शेव पुरी दही पुरी",   "aliases": []},
]

POHA_MURMURE = [
    {"en": "Aloo Kande Pohe",   "mr": "आलू कांदा पोहे",      "aliases": ["Onion Potato Poha"]},
    {"en": "Dahi Pohe",         "mr": "दही पोहे",            "aliases": []},
    {"en": "Dadpe Pohe",        "mr": "दडपे पोहे",           "aliases": []},
    {"en": "Dable Pohe",        "mr": "दबले पोहे",           "aliases": []},
    {"en": "Chana Pohe",        "mr": "चणा पोहे",            "aliases": []},
    {"en": "Sambar Pohe",       "mr": "सांबार पोहे",          "aliases": []},
    {"en": "Poha Kaccha Chivda","mr": "पोहा कच्चा चिवडा",    "aliases": []},
    {"en": "Poha Pakka Chivda", "mr": "पोहा पक्का चिवडा",    "aliases": []},
    {"en": "Dahi Murmure",      "mr": "दही मुरमुरे",          "aliases": []},
    {"en": "Ole Murmure",       "mr": "ओले मुरमुरे",          "aliases": []},
    {"en": "Murmure Chivda",    "mr": "मुरमुरे चिवडा",        "aliases": []},
]

FRIED_ITEMS = [
    {"en": "French Fries",      "mr": "फ्रेंच फ्राईज",        "aliases": []},
    {"en": "Puri Bhaji",        "mr": "पुरी भाजी",            "aliases": []},
    {"en": "Pakode",            "mr": "पकोडे",               "aliases": ["Pakora", "Bhaje"]},
    {"en": "Chole Bhature",     "mr": "छोले भटुरे",          "aliases": []},
    {"en": "Kachori",           "mr": "कचोरी",               "aliases": []},
    {"en": "Samose",            "mr": "समोसे",               "aliases": ["Samosa"]},
]

PANEER = [
    {"en": "Paneer Tikki",          "mr": "पनीर टिक्की",          "aliases": []},
    {"en": "Paneer Gobi Paratha",   "mr": "पनीर गोबी पराठा",      "aliases": []},
    {"en": "Chilli Paneer",         "mr": "चिली पनीर",           "aliases": []},
]

MAHARASHTRIAN = [
    {"en": "Dhapde",            "mr": "धपडे",                "aliases": []},
    {"en": "Ukadpendi",         "mr": "उकडपेंडी",             "aliases": []},
    {"en": "Mokalpeeth",        "mr": "मोकळपीठ",             "aliases": []},
    {"en": "Thalipeeth",        "mr": "थालिपीठ",             "aliases": []},
    {"en": "Parathe",           "mr": "पराठे",               "aliases": ["Paratha"]},
    {"en": "Ayte",              "mr": "आयते",                "aliases": []},
    {"en": "Methi Roll",        "mr": "मेथी रोल",            "aliases": []},
    {"en": "Methi Fal",         "mr": "मेथी फळ",             "aliases": []},
    {"en": "God Dhirde",        "mr": "गोड धिर्डे",           "aliases": []},
    {"en": "Daliya",            "mr": "दलिया",               "aliases": ["Broken Wheat"]},
    {"en": "Dudhi Thalipeeth",  "mr": "दुधी थालिपीठ",         "aliases": ["Bottle Gourd Thalipeeth"]},
    {"en": "Dudhi Vade",        "mr": "दुधी वडे",             "aliases": ["Bottle Gourd Vade"]},
]

FAST_FOOD = [
    {"en": "Frankie",                 "mr": "फ्रँकी",              "aliases": ["Kathi Roll"]},
    {"en": "Mushroom Wrap",           "mr": "मशरूम रॅप",          "aliases": []},
    {"en": "Monaco Biscuit Snacks",   "mr": "मोनाको बिस्किट स्नॅक्स","aliases": []},
    {"en": "Crispy Corn",             "mr": "क्रिस्पी कॉर्न",       "aliases": []},
    {"en": "Maggi",                   "mr": "मॅगी",               "aliases": ["Maggi Noodles"]},
    {"en": "Shevai Upma",             "mr": "शेवई उपमा",          "aliases": ["Vermicelli Upma"]},
]

PARATHE = [
    {"en": "Mixed Stuffed Paratha",   "mr": "मिक्स स्टफ्ड पराठा",   "aliases": []},
    {"en": "Palak Paratha",           "mr": "पालक पराठा",          "aliases": ["Spinach Paratha"]},
    {"en": "Beetroot Paratha",        "mr": "बीटरूट पराठा",         "aliases": []},
    {"en": "Aloo Paratha",            "mr": "बटाटा पराठा",          "aliases": ["Potato Paratha"]},
    {"en": "Tomato Paratha",          "mr": "टोमॅटो पराठा",         "aliases": []},
    {"en": "Peas Paratha",            "mr": "मटार पराठा",           "aliases": ["Matar Paratha"]},
    {"en": "Methi Paratha",           "mr": "मेथी पराठा",           "aliases": ["Fenugreek Paratha"]},
    {"en": "Carrot Paratha",          "mr": "गाजर पराठा",           "aliases": []},
    {"en": "Paneer Cauliflower Paratha", "mr": "पनीर फुलकोबी पराठा","aliases": []},
    {"en": "Cabbage Paratha",         "mr": "कोबी पराठा",           "aliases": []},
    {"en": "Radish Paratha",          "mr": "मुळा पराठा",           "aliases": ["Mooli Paratha"]},
    {"en": "Drumstick Leaves Paratha","mr": "शेवग्याच्या पाल्याचा पराठा","aliases": []},
    {"en": "Cauliflower Paratha",     "mr": "फुलकोबी पराठा",        "aliases": []},
    {"en": "Paneer Onion Paratha",    "mr": "पनीर कांदा पराठा",     "aliases": []},
    {"en": "Mix Veg Paratha",         "mr": "मिक्स व्हेज पराठा",     "aliases": []},
    {"en": "Brinjal Paratha",         "mr": "वांगे पराठा",          "aliases": []},
    {"en": "Watermelon Paratha",      "mr": "कलिंगडाचा पराठा",      "aliases": []},
    {"en": "Gram Flour Paratha",      "mr": "बेसन पराठा",           "aliases": ["Besan Paratha"]},
    {"en": "Curd Dhapde",             "mr": "दही धपडे",             "aliases": []},
    {"en": "Beri Dhapde",             "mr": "बेरी धपडे",            "aliases": []},
]

RAJASTHANI = [
    {"en": "Daal Bati",         "mr": "दाल बाटी",             "aliases": ["Dal Baati"]},
]

# Public registry — same shape as EVERYDAY_MENU so the frontend picks
# which to render based on meal type without separate plumbing.
BREAKFAST_SNACKS_MENU = {
    "SouthIndian":   SOUTH_INDIAN,
    "Gujarati":      GUJARATI,
    "PavBread":      PAV_BREAD,
    "Upvas":         UPVAS,
    "Chaat":         CHAAT,
    "PohaMurmure":   POHA_MURMURE,
    "FriedItems":    FRIED_ITEMS,
    "Paneer":        PANEER,
    "Maharashtrian": MAHARASHTRIAN,
    "FastFood":      FAST_FOOD,
    "Parathe":       PARATHE,
    "Rajasthani":    RAJASTHANI,
}


def breakfast_summary():
    return {
        "categories": {k: len(v) for k, v in BREAKFAST_SNACKS_MENU.items()},
        "total": sum(len(v) for v in BREAKFAST_SNACKS_MENU.values()),
    }
