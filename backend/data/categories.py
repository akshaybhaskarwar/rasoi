"""
Category keywords for auto-detection in Rasoi-Sync
"""

CATEGORY_KEYWORDS = {
    'grains': ['rice', 'wheat', 'flour', 'atta', 'maida', 'sooji', 'rava', 'poha', 'oats', 'barley', 'millet', 'bajra', 'jowar', 'ragi', 'quinoa', 'semolina', 'besan', 'gram flour'],
    'spices': ['masala', 'spice', 'powder', 'turmeric', 'haldi', 'chili', 'mirchi', 'cumin', 'jeera', 'coriander', 'dhania', 'garam masala', 'biryani', 'curry', 'pepper', 'cardamom', 'elaichi', 'cinnamon', 'dalchini', 'clove', 'laung', 'ajwain', 'carom', 'mustard', 'rai', 'fenugreek', 'methi', 'asafoetida', 'hing', 'nutmeg', 'saffron', 'kesar', 'bay leaf', 'tej patta', 'salt', 'namak'],
    'pulses': ['dal', 'lentil', 'chana', 'chickpea', 'moong', 'toor', 'arhar', 'urad', 'masoor', 'rajma', 'kidney bean', 'black gram', 'green gram', 'split pea', 'moth', 'lobiya', 'chole'],
    'dairy': ['milk', 'doodh', 'ghee', 'butter', 'paneer', 'cheese', 'curd', 'yogurt', 'dahi', 'cream', 'khoya', 'mawa', 'condensed milk'],
    'oils': ['oil', 'tel', 'ghee', 'coconut oil', 'mustard oil', 'sunflower', 'groundnut', 'olive', 'sesame', 'til'],
    'bakery': ['bread', 'roti', 'naan', 'pav', 'bun', 'cake', 'biscuit', 'cookie', 'toast', 'croissant'],
    'snacks': ['chips', 'namkeen', 'bhujia', 'mixture', 'papad', 'crackers', 'wafers', 'popcorn', 'makhana', 'fox nuts'],
    'beverages': ['tea', 'chai', 'coffee', 'juice', 'drink', 'sharbat', 'lassi', 'buttermilk', 'chaas'],
    'vegetables': ['vegetable', 'sabzi', 'potato', 'aloo', 'onion', 'pyaaz', 'tomato', 'tamatar', 'carrot', 'gajar', 'peas', 'matar', 'beans', 'cabbage', 'cauliflower', 'gobi', 'spinach', 'palak', 'brinjal', 'baingan', 'okra', 'bhindi', 'capsicum', 'shimla mirch'],
    'medicine': ['Citrizine'],
    'fruits': ['fruit', 'apple', 'banana', 'mango', 'aam', 'orange', 'santra', 'grapes', 'angoor', 'pomegranate', 'anar', 'papaya', 'guava', 'amrood', 'watermelon', 'pineapple']
}


def guess_category(product_name: str) -> str:
    """Guess category based on product name keywords"""
    if not product_name:
        return 'other'
    
    product_lower = product_name.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in product_lower:
                return category
    
    return 'other'
