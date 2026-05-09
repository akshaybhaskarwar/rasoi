"""
Centralized Pantry Items Database for Rasoi-Sync
This is the SINGLE SOURCE OF TRUTH for all pantry item definitions.
Used by:
- Essentials Pack (households.py)
- Indian Pantry Template (frontend)
- Category auto-detection
"""

# Unit rules by category
CATEGORY_UNITS = {
    "grains": "kg",
    "pulses": "g",
    "spices": "g",
    "oils": "L",
    "dairy": "L",
    "sweeteners": "g",  # Sugar, Jaggery, Honey etc.
    "beverages": "g",
    "vegetables": "kg",
    "fruits": "kg",
    "bakery": "pcs",
    "household": "pcs",
    "snacks": "g",
    "fasting": "g",
    "other": "pcs"
}

# Complete Indian Pantry Items organized by main category -> subcategory
PANTRY_TEMPLATE = {
    "GROCERY": {
        "display_name": "🛒 GROCERY (किराणा)",
        "subcategories": {
            "grains": {
                "display_name": "🌾 Grains, Rice, Rava & Cereals",
                "color": "bg-amber-50",
                "category": "grains",
                "items": [
                    {"en": "Rice", "mr": "तांदूळ", "hi": "चावल", "aliases": ["Tandul", "Chawal"], "monthly_qty": 5000},
                    {"en": "Basmati Rice", "mr": "बासमती तांदूळ", "hi": "बासमती चावल", "aliases": ["Basmati Tandul"], "monthly_qty": 15000},
                    {"en": "Indrayani Rice", "mr": "इंद्रायणी तांदूळ", "hi": "इंद्रायणी चावल", "aliases": ["Indrayani Tandul"]},
                    {"en": "Kolam Rice", "mr": "कोलम तांदूळ", "hi": "कोलम चावल", "aliases": ["Kolam Tandul"]},
                    {"en": "Sona Masoori Rice", "mr": "सोना मसूरी तांदूळ", "hi": "सोना मसूरी चावल"},
                    {"en": "Broken Rice", "mr": "तुटलेला तांदूळ", "hi": "टूटा चावल"},
                    {"en": "Wheat", "mr": "गहू", "hi": "गेहूं", "aliases": ["Gahu", "Gehun"], "monthly_qty": 5000},
                    {"en": "Wheat Flour", "mr": "गव्हाचे पीठ", "hi": "गेहूं का आटा", "aliases": ["Gavhache Peeth", "Atta"], "monthly_qty": 5000},
                    {"en": "Rice Flour", "mr": "तांदळाचे पीठ", "hi": "चावल का आटा", "aliases": ["Tandlache Peeth"], "monthly_qty": 2000},
                    {"en": "Gram Flour", "mr": "बेसन", "hi": "बेसन", "aliases": ["Besan"], "monthly_qty": 2000},
                    {"en": "Maida", "mr": "मैदा", "hi": "मैदा", "aliases": ["All Purpose Flour", "Refined Flour"], "monthly_qty": 250},
                    {"en": "Jowar (Sorghum)", "mr": "ज्वारी", "hi": "ज्वार", "aliases": ["Jwari"]},
                    {"en": "Jowar Flour", "mr": "ज्वारीचे पीठ", "hi": "ज्वार का आटा", "aliases": ["Jwari Peeth"], "monthly_qty": 2000},
                    {"en": "Bajra (Pearl Millet)", "mr": "बाजरी", "hi": "बाजरा", "aliases": ["Bajri"]},
                    {"en": "Bajra Flour", "mr": "बाजरीचे पीठ", "hi": "बाजरा आटा", "aliases": ["Bajri Peeth"]},
                    {"en": "Ragi (Finger Millet)", "mr": "नाचणी", "hi": "रागी", "aliases": ["Nachni"]},
                    {"en": "Ragi Flour", "mr": "नाचणी पीठ", "hi": "रागी का आटा", "aliases": ["Nachni Peeth"]},
                    {"en": "Barley", "mr": "जव", "hi": "जौ", "aliases": ["Jav"]},
                    {"en": "Oats", "mr": "ओट्स", "hi": "ओट्स"},
                    {"en": "Quinoa", "mr": "क्विनोआ", "hi": "क्विनोआ"},
                    {"en": "Amaranth (Rajgira)", "mr": "राजगिरा", "hi": "राजगिरा", "aliases": ["Rajgira"]},
                    {"en": "Buckwheat", "mr": "कुट्टू", "hi": "कुट्टू", "aliases": ["Kuttu"]},
                    {"en": "Foxtail Millet (Kangni)", "mr": "कांगणी / राळा", "hi": "कांगनी", "aliases": ["Kangni", "Rala"]},
                    {"en": "Little Millet (Kutki)", "mr": "कुटकी / वरी", "hi": "कुटकी", "aliases": ["Kutki", "Vari"]},
                    {"en": "Kodo Millet", "mr": "कोदो", "hi": "कोदो", "aliases": ["Kodra"]},
                    {"en": "Barnyard Millet", "mr": "भगर", "hi": "सांवा", "aliases": ["Bhagar", "Sanwa"]},
                    {"en": "Proso Millet", "mr": "वरी तांदूळ", "hi": "चेना", "aliases": ["Vari Tandul"]},
                    {"en": "Maize (Corn)", "mr": "मका", "hi": "मक्का", "aliases": ["Maka", "Makka"]},
                    {"en": "Corn Flour (Makai Atta)", "mr": "मक्याचे पीठ", "hi": "मक्के का आटा", "aliases": ["Makai Peeth", "Cornflour"], "monthly_qty": 1000},
                    {"en": "Dalia (Broken Wheat)", "mr": "दलिया / फुटलेला गहू", "hi": "दलिया", "aliases": ["Daliya", "Wheat Daliya"], "monthly_qty": 200},
                    {"en": "Dalwa", "mr": "डाळवा", "hi": "दलवा", "aliases": ["Dalwa"]},
                    {"en": "Rava", "mr": "रवा", "hi": "रवा", "aliases": ["Rawa", "Sooji", "Suji"], "monthly_qty": 2000},
                    {"en": "Roasted Rava", "mr": "भाजलेला रवा", "hi": "भुना रवा", "aliases": ["Bhajlela Rawa"], "monthly_qty": 100},
                    {"en": "Barik Rava", "mr": "बारीक रवा", "hi": "बारीक रवा"},
                    {"en": "Jada Rava", "mr": "जाड रवा", "hi": "मोटा रवा"},
                    {"en": "Upma Rava", "mr": "उपमा रवा", "hi": "उपमा रवा"},
                    {"en": "Idli Rava", "mr": "इडली रवा", "hi": "इडली रवा"}
                ]
            },
            "pulses": {
                "display_name": "🫘 Pulses, Beans & Chana",
                "color": "bg-yellow-50",
                "category": "pulses",
                "items": [
                    {"en": "Toor Dal", "mr": "तूर डाळ", "hi": "तूर दाल", "aliases": ["Tur Dal", "Arhar Dal"], "monthly_qty": 2000},
                    {"en": "Moong Dal", "mr": "मूग डाळ", "hi": "मूंग दाल", "aliases": ["Mung Dal"], "monthly_qty": 2000},
                    {"en": "Moong Dal (Split)", "mr": "मूग डाळ सोललेली", "hi": "मूंग दाल छिलकी", "aliases": ["Moong Dal Sola"], "monthly_qty": 1000},
                    {"en": "Masoor Dal", "mr": "मसूर डाळ", "hi": "मसूर दाल", "aliases": ["Mohri Dal", "Red Lentils"], "monthly_qty": 500},
                    {"en": "Chana Dal", "mr": "चणा डाळ", "hi": "चना दाल", "aliases": ["Harbhara Dal", "Chana Daal"], "monthly_qty": 500},
                    {"en": "Urad Dal", "mr": "उडीद डाळ", "hi": "उड़द दाल", "aliases": ["Udid Dal"]},
                    {"en": "Whole Green Gram", "mr": "हिरवा मूग", "hi": "हरा मूंग", "aliases": ["Hirva Mung"]},
                    {"en": "Whole Black Gram", "mr": "काळा उडीद", "hi": "काला उड़द", "aliases": ["Kala Udid"]},
                    {"en": "Sadha Chana (Desi Chana)", "mr": "साधा चणा", "hi": "देसी चना", "aliases": ["Sadha Chana"]},
                    {"en": "Kabuli Chana", "mr": "काबुली चणे", "hi": "काबुली चना", "aliases": ["Chole", "Chickpeas"]},
                    {"en": "Matki", "mr": "मटकी", "hi": "मोठ", "aliases": ["Moth Beans"]},
                    {"en": "Vatana", "mr": "वाटाणा", "hi": "मटर", "aliases": ["Dried Peas", "Matar"]},
                    {"en": "Rajma", "mr": "राजमा", "hi": "राजमा", "aliases": ["Kidney Beans"]},
                    {"en": "Cowpeas Big", "mr": "चवळी मोठी", "hi": "लोबिया बड़ी", "aliases": ["Chavli", "Lobiya"]},
                    {"en": "Cowpeas Small", "mr": "चवळी बारीक", "hi": "लोबिया छोटी", "aliases": ["Chavli Barik"]}
                ]
            },
            "poha_puffed": {
                "display_name": "🥣 Poha, Puffed & Light Items",
                "color": "bg-orange-50",
                "category": "snacks",
                "items": [
                    {"en": "Thick Poha", "mr": "जाड पोहे", "hi": "मोटा पोहा"},
                    {"en": "Thin Poha", "mr": "पातळ पोहे", "hi": "पतला पोहा"},
                    {"en": "Medium Poha", "mr": "मध्यम पोहे", "hi": "मध्यम पोहा"},
                    {"en": "White Poha", "mr": "पांढरे पोहे", "hi": "सफेद पोहा"},
                    {"en": "Red Poha", "mr": "लाल पोहे", "hi": "लाल पोहा"},
                    {"en": "Nylon Poha", "mr": "नायलॉन पोहे", "hi": "नायलॉन पोहा"},
                    {"en": "Chivda Poha", "mr": "चिवड्याचे पोहे", "hi": "चिवड़ा पोहा"},
                    {"en": "Murmura (Puffed Rice)", "mr": "मुरमुरे", "hi": "मुरमुरा"},
                    {"en": "Poha", "mr": "पोहे", "hi": "पोहा", "aliases": ["Pohe", "Flattened Rice"], "monthly_qty": 500}
                ]
            },
            "fasting": {
                "display_name": "🔱 Upvas / Fasting Items",
                "color": "bg-purple-50",
                "category": "fasting",
                "items": [
                    {"en": "Bhagar / Sama Rice", "mr": "भगर / सामा तांदूळ", "hi": "समा के चावल", "aliases": ["Bhagar", "Sama Rice", "Varai"], "monthly_qty": 500},
                    {"en": "Vari Rice", "mr": "वरी तांदूळ", "hi": "वरी चावल", "aliases": ["Varai", "Vari Tandul"], "monthly_qty": 250},
                    {"en": "Rajgira Seeds", "mr": "राजगिरा", "hi": "राजगिरा", "aliases": ["Rajgira", "Amaranth Seeds"]},
                    {"en": "Rajgira Flour", "mr": "राजगिरा पीठ", "hi": "राजगिरा का आटा", "aliases": ["Rajgira Peeth"]},
                    {"en": "Rajgira Lahi", "mr": "राजगिरा लाही", "hi": "राजगिरा लाई", "aliases": ["Rajgeera Lahi", "Puffed Amaranth"], "monthly_qty": 250},
                    {"en": "Sabudana", "mr": "साबुदाणा", "hi": "साबूदाना", "aliases": ["Sago", "Tapioca Pearls"], "monthly_qty": 2000},
                    {"en": "Sabudana Flour", "mr": "साबुदाणा पीठ", "hi": "साबूदाना आटा", "aliases": ["Sago Flour"]},
                    {"en": "Singhada Flour", "mr": "शिंगाड्याचे पीठ", "hi": "सिंघाड़े का आटा", "aliases": ["Water Chestnut Flour"]},
                    {"en": "Groundnuts", "mr": "शेंगदाणे", "hi": "मूंगफली", "aliases": ["Peanuts", "Shengdane", "Moongfali"], "monthly_qty": 1000},
                    {"en": "Rock Salt", "mr": "सैंधव मीठ", "hi": "सेंधा नमक", "aliases": ["Sendha Namak", "Saindhav Meeth"]}
                ]
            },
            "spices_whole": {
                "display_name": "🌶️ Spices (Whole & Powdered)",
                "color": "bg-red-50",
                "category": "spices",
                "items": [
                    {"en": "Salt", "mr": "मीठ", "hi": "नमक", "aliases": ["Meeth", "Namak"], "monthly_qty": 2000},
                    {"en": "Turmeric Powder", "mr": "हळद पावडर", "hi": "हल्दी पाउडर", "aliases": ["Halad", "Haldi"], "monthly_qty": 100},
                    {"en": "Red Chili Powder", "mr": "लाल मिरची पूड", "hi": "लाल मिर्च पाउडर", "aliases": ["Lal Mirchi", "Tikhat"], "monthly_qty": 100},
                    {"en": "Coriander Seeds", "mr": "धणे", "hi": "धनिया", "aliases": ["Dhane", "Dhaniya"], "monthly_qty": 1000},
                    {"en": "Coriander Powder", "mr": "धणे पूड", "hi": "धनिया पाउडर", "aliases": ["Dhane Pood", "Dhaniya Powder"], "monthly_qty": 100},
                    {"en": "Cumin Seeds", "mr": "जिरे", "hi": "जीरा", "aliases": ["Jeera", "Jire"], "monthly_qty": 1000},
                    {"en": "Mustard Seeds", "mr": "मोहरी", "hi": "राई", "aliases": ["Mohri", "Rai"], "monthly_qty": 50},
                    {"en": "Black Pepper", "mr": "काळी मिरी", "hi": "काली मिर्च", "aliases": ["Kali Mirchi", "Miri"]},
                    {"en": "Cloves", "mr": "लवंग", "hi": "लौंग", "aliases": ["Lavang", "Laung"]},
                    {"en": "Cinnamon", "mr": "दालचिनी", "hi": "दालचीनी", "aliases": ["Dalchini"]},
                    {"en": "Green Cardamom", "mr": "हिरवी वेलची", "hi": "हरी इलायची", "aliases": ["Velchi", "Elaichi", "Cardamom Small"], "monthly_qty": 25},
                    {"en": "Black Cardamom", "mr": "काळी वेलची", "hi": "काली इलायची", "aliases": ["Kali Velchi", "Badi Elaichi"], "monthly_qty": 100},
                    {"en": "Bay Leaf", "mr": "तमालपत्र", "hi": "तेज पत्ता", "aliases": ["Tamalpatri", "Tej Patta"], "monthly_qty": 50},
                    {"en": "Asafoetida (Hing)", "mr": "हिंग", "hi": "हींग", "aliases": ["Hing"]},
                    {"en": "Dry Ginger", "mr": "सुंठ", "hi": "सोंठ", "aliases": ["Sunth", "Sonth"], "monthly_qty": 100},
                    {"en": "Fennel Seeds", "mr": "बडीशेप", "hi": "सौंफ", "aliases": ["Badishep", "Saunf"]},
                    {"en": "Sesame Seeds", "mr": "तीळ", "hi": "तिल", "aliases": ["Til", "Teel"]},
                    {"en": "Poppy Seeds", "mr": "खसखस", "hi": "खसखस", "aliases": ["Khaskhas", "Posto"], "monthly_qty": 125},
                    {"en": "Nutmeg", "mr": "जायफळ", "hi": "जायफल", "aliases": ["Jaiphal", "Jayfal"], "monthly_qty": 25},
                    {"en": "Mace", "mr": "जावित्री", "hi": "जावित्री", "aliases": ["Javitri"]},
                    {"en": "Kasoori Methi", "mr": "कसुरी मेथी", "hi": "कसूरी मेथी", "aliases": ["Dried Fenugreek Leaves"], "monthly_qty": 200},
                    {"en": "Dhana Daal", "mr": "धना डाळ", "hi": "धना दाल", "aliases": ["Dhana Dal"]}
                ]
            },
            "masalas": {
                "display_name": "🌶️ Ready Masalas",
                "color": "bg-red-100",
                "category": "spices",
                "items": [
                    {"en": "Garam Masala", "mr": "गरम मसाला", "hi": "गरम मसाला", "aliases": ["Garam Masala"], "monthly_qty": 50},
                    {"en": "Goda Masala", "mr": "गोडा मसाला", "hi": "गोडा मसाला", "aliases": ["Goda Masala"]},
                    {"en": "Misal Masala", "mr": "मिसळ मसाला", "hi": "मिसल मसाला"},
                    {"en": "Kolhapuri Masala", "mr": "कोल्हापुरी मसाला", "hi": "कोल्हापुरी मसाला"},
                    {"en": "Malvani Masala", "mr": "मालवणी मसाला", "hi": "मालवणी मसाला"},
                    {"en": "Pav Bhaji Masala", "mr": "पावभाजी मसाला", "hi": "पाव भाजी मसाला", "monthly_qty": 50},
                    {"en": "Chaat Masala", "mr": "चाट मसाला", "hi": "चाट मसाला", "monthly_qty": 100},
                    {"en": "Chhole Masala", "mr": "छोले मसाला", "hi": "छोले मसाला", "aliases": ["Chole Masala", "Chana Masala"], "monthly_qty": 100},
                    {"en": "Pani Puri Masala", "mr": "पाणीपुरी मसाला", "hi": "पानी पूरी मसाला"},
                    {"en": "Biryani Masala", "mr": "बिर्याणी मसाला", "hi": "बिरयानी मसाला"},
                    {"en": "Pulav Masala", "mr": "पुलाव मसाला", "hi": "पुलाव मसाला"},
                    {"en": "Sambhar Masala", "mr": "सांबार मसाला", "hi": "सांभर मसाला", "monthly_qty": 100}
                ]
            },
            "instant_mixes": {
                "display_name": "🥣 Instant Mixes",
                "color": "bg-orange-100",
                "category": "snacks",
                "items": [
                    {"en": "Upma Mix", "mr": "उपमा मिक्स", "hi": "उपमा मिक्स"},
                    {"en": "Poha Mix", "mr": "पोहे मिक्स", "hi": "पोहा मिक्स"},
                    {"en": "Idli Mix", "mr": "इडली मिक्स", "hi": "इडली मिक्स"},
                    {"en": "Dosa Mix", "mr": "डोसा मिक्स", "hi": "डोसा मिक्स"},
                    {"en": "Medu Vada Mix", "mr": "मेदू वडा मिक्स", "hi": "मेदू वड़ा मिक्स"},
                    {"en": "Dhokla Mix", "mr": "ढोकळा मिक्स", "hi": "ढोकला मिक्स"},
                    {"en": "Gulab Jamun Mix", "mr": "गुलाबजाम मिक्स", "hi": "गुलाब जामुन मिक्स"},
                    {"en": "Missal Ready Mix", "mr": "मिसळ रेडी मिक्स", "hi": "मिसल रेडी मिक्स"}
                ]
            },
            "oils": {
                "display_name": "🧴 Oils & Cooking Fats",
                "color": "bg-yellow-100",
                "category": "oils",
                "items": [
                    {"en": "Cooking Oil", "mr": "तेल", "hi": "तेल", "aliases": ["Tel"], "monthly_qty": 2000},
                    {"en": "Groundnut Oil", "mr": "शेंगदाणा तेल", "hi": "मूंगफली तेल", "aliases": ["Shengdana Tel", "Moongfali Tel"], "monthly_qty": 5000},
                    {"en": "Coconut Oil", "mr": "नारळ तेल", "hi": "नारियल तेल", "aliases": ["Naral Tel"]},
                    {"en": "Mustard Oil", "mr": "मोहरी तेल", "hi": "सरसों तेल", "aliases": ["Mohri Tel", "Sarson Tel"]},
                    {"en": "Sunflower Oil", "mr": "सूर्यफूल तेल", "hi": "सूरजमुखी तेल", "aliases": ["Suryaphul Tel"], "monthly_qty": 5000},
                    {"en": "Olive Oil", "mr": "ऑलिव्ह ऑइल", "hi": "जैतून का तेल"},
                    {"en": "Sesame Oil", "mr": "तिळाचे तेल", "hi": "तिल का तेल", "aliases": ["Tilache Tel"]},
                    {"en": "Ghee", "mr": "तूप", "hi": "घी", "aliases": ["Tup"], "monthly_qty": 500, "unit_override": "ml"}
                ]
            },
            "sweeteners": {
                "display_name": "🍯 Sweeteners",
                "color": "bg-amber-100",
                "category": "sweeteners",
                "items": [
                    {"en": "Sugar", "mr": "साखर", "hi": "चीनी", "aliases": ["Sakhar", "Cheeni"], "monthly_qty": 5000},
                    {"en": "Jaggery", "mr": "गूळ", "hi": "गुड़", "aliases": ["Gul", "Gud"], "monthly_qty": 500},
                    {"en": "Mishri", "mr": "खडीसाखर", "hi": "मिश्री", "aliases": ["Khadisakhar", "Rock Sugar"]},
                    {"en": "Honey", "mr": "मध", "hi": "शहद", "aliases": ["Madh", "Shahad"]},
                    {"en": "Brown Sugar", "mr": "ब्राउन साखर", "hi": "ब्राउन शुगर"},
                    {"en": "Powdered Sugar", "mr": "पिठी साखर", "hi": "पिसी चीनी", "aliases": ["Pithi Sakhar"]}
                ]
            },
            "condiments": {
                "display_name": "🥫 Condiments & Sauces",
                "color": "bg-orange-50",
                "category": "other",
                "items": [
                    {"en": "Tamarind", "mr": "चिंच", "hi": "इमली", "aliases": ["Chinch", "Imli"], "monthly_qty": 2500},
                    {"en": "Coconut (Grated)", "mr": "नारळ किसलेला", "hi": "कसा हुआ नारियल", "aliases": ["Naral Kislela", "Khopra"], "monthly_qty": 500},
                    {"en": "Kokum", "mr": "कोकम", "hi": "कोकम"},
                    {"en": "Tomato Ketchup", "mr": "टोमॅटो केचप", "hi": "टोमैटो केचप"},
                    {"en": "Soy Sauce", "mr": "सोया सॉस", "hi": "सोया सॉस"},
                    {"en": "Vinegar", "mr": "व्हिनेगर", "hi": "सिरका", "aliases": ["Sirka"]},
                    {"en": "Green Chutney", "mr": "हिरवी चटणी", "hi": "हरी चटनी"}
                ]
            },
            "beverages": {
                "display_name": "☕ Tea, Coffee & Packaged",
                "color": "bg-amber-50",
                "category": "beverages",
                "items": [
                    {"en": "Tea Leaves", "mr": "चहा पावडर", "hi": "चाय पत्ती", "aliases": ["Chaha", "Chai", "Tea Powder"], "monthly_qty": 2000},
                    {"en": "Coffee Powder", "mr": "कॉफी पावडर", "hi": "कॉफी पाउडर", "aliases": ["Coffee"], "monthly_qty": 250},
                    {"en": "Green Tea", "mr": "ग्रीन टी", "hi": "ग्रीन टी"},
                    {"en": "Biscuits", "mr": "बिस्किटे", "hi": "बिस्कुट"},
                    {"en": "Rusk", "mr": "टोस्ट बिस्किटे", "hi": "रस्क"}
                ]
            },
            "dry_fruits": {
                "display_name": "🥜 Dry Fruits & Nuts",
                "color": "bg-yellow-50",
                "category": "other",
                "items": [
                    {"en": "Cashews", "mr": "काजू", "hi": "काजू", "aliases": ["Kaju"], "monthly_qty": 250},
                    {"en": "Almonds", "mr": "बदाम", "hi": "बादाम", "aliases": ["Badam"], "monthly_qty": 500},
                    {"en": "Walnuts", "mr": "अक्रोड", "hi": "अखरोट", "aliases": ["Akrod", "Akhrot"], "monthly_qty": 1000},
                    {"en": "Raisins", "mr": "बेदाणे", "hi": "किशमिश", "aliases": ["Bedane", "Kishmish"]},
                    {"en": "Dates", "mr": "खजूर", "hi": "खजूर", "aliases": ["Khajoor"]},
                    {"en": "Dried Figs", "mr": "अंजीर", "hi": "अंजीर", "aliases": ["Anjeer"]},
                    {"en": "Dried Coconut", "mr": "खोबरं", "hi": "सूखा नारियल", "aliases": ["Khobra", "Copra"]},
                    {"en": "Supari", "mr": "सुपारी", "hi": "सुपारी", "aliases": ["Betel Nut"], "monthly_qty": 250},
                    {"en": "Mukhwas", "mr": "मुखवास", "hi": "मुखवास", "aliases": ["Mukwas", "Mouth Freshener"], "monthly_qty": 1000}
                ]
            },
            "snack_items": {
                "display_name": "🍿 Snack Ingredients",
                "color": "bg-orange-100",
                "category": "snacks",
                "items": [
                    {"en": "Boondi", "mr": "बुंदी", "hi": "बूंदी", "aliases": ["Bundi"], "monthly_qty": 500},
                    {"en": "Bhujiya Sev", "mr": "भुजिया शेव", "hi": "भुजिया सेव", "aliases": ["Bhujiya Sheva", "Sev"], "monthly_qty": 100}
                ]
            }
        }
    },
    "MANDI": {
        "display_name": "🥕 MANDI (भाजी मंडई)",
        "subcategories": {
            "vegetables": {
                "display_name": "🧅 Vegetables",
                "color": "bg-green-50",
                "category": "vegetables",
                "items": [
                    {"en": "Onion", "mr": "कांदा", "hi": "प्याज", "aliases": ["Kanda", "Pyaaz"]},
                    {"en": "Potato", "mr": "बटाटा", "hi": "आलू", "aliases": ["Batata", "Aloo"]},
                    {"en": "Tomato", "mr": "टोमॅटो", "hi": "टमाटर", "aliases": ["Tamatar"]},
                    {"en": "Brinjal", "mr": "वांगी", "hi": "बैंगन"},
                    {"en": "Okra", "mr": "भेंडी", "hi": "भिंडी"},
                    {"en": "Tondli", "mr": "तोंडले", "hi": "टिंडे"},
                    {"en": "Raw Banana", "mr": "कच्ची केळी", "hi": "कच्चा केला"},
                    {"en": "Cabbage", "mr": "कोबी", "hi": "पत्तागोभी", "aliases": ["Kobi", "Patta Gobhi"]},
                    {"en": "Cauliflower", "mr": "फुलकोबी", "hi": "फूलगोभी", "aliases": ["Phulkobi", "Phool Gobhi"]},
                    {"en": "Capsicum", "mr": "ढोबळी मिरची", "hi": "शिमला मिर्च", "aliases": ["Dhobli Mirchi", "Shimla Mirch"]},
                    {"en": "Carrot", "mr": "गाजर", "hi": "गाजर", "aliases": ["Gajar"]},
                    {"en": "Radish", "mr": "मुळा", "hi": "मूली"},
                    {"en": "Beetroot", "mr": "बीट", "hi": "चुकंदर"},
                    {"en": "Pumpkin", "mr": "भोपळा", "hi": "कद्दू"},
                    {"en": "Sweet Corn", "mr": "मका", "hi": "मक्का"},
                    {"en": "Green Peas", "mr": "हिरवे वाटाणे", "hi": "हरे मटर"},
                    {"en": "Sweet Potato", "mr": "रताळे", "hi": "शकरकंद"}
                ]
            },
            "leafy_vegetables": {
                "display_name": "🌿 Leafy Vegetables",
                "color": "bg-green-100",
                "category": "vegetables",
                "items": [
                    {"en": "Coriander Leaves", "mr": "कोथिंबीर", "hi": "हरा धनिया"},
                    {"en": "Fenugreek Leaves", "mr": "मेथी", "hi": "मेथी"},
                    {"en": "Spinach", "mr": "पालक", "hi": "पालक"},
                    {"en": "Dill Leaves", "mr": "शेपू", "hi": "सोया"},
                    {"en": "Sorrel Leaves", "mr": "आंबाडी", "hi": "अम्बाड़ी"},
                    {"en": "Red Amaranth", "mr": "लाल भाजी", "hi": "लाल साग"}
                ]
            },
            "mushrooms": {
                "display_name": "🍄 Mushrooms",
                "color": "bg-gray-50",
                "category": "vegetables",
                "items": [
                    {"en": "Button Mushroom", "mr": "मशरूम", "hi": "मशरूम"},
                    {"en": "Oyster Mushroom", "mr": "ऑइस्टर मशरूम", "hi": "ऑयस्टर मशरूम"}
                ]
            },
            "exotic_vegetables": {
                "display_name": "🥦 Exotic Vegetables",
                "color": "bg-lime-50",
                "category": "vegetables",
                "items": [
                    {"en": "Broccoli", "mr": "ब्रोकोली", "hi": "ब्रोकोली"},
                    {"en": "Zucchini", "mr": "झुकिनी", "hi": "जुकिनी"},
                    {"en": "Baby Corn", "mr": "बेबी कॉर्न", "hi": "बेबी कॉर्न"},
                    {"en": "Lettuce", "mr": "लेट्यूस", "hi": "लेट्यूस"},
                    {"en": "Cherry Tomatoes", "mr": "चेरी टोमॅटो", "hi": "चेरी टमाटर"}
                ]
            },
            "fruits": {
                "display_name": "🍎 Fruits",
                "color": "bg-pink-50",
                "category": "fruits",
                "items": [
                    {"en": "Banana", "mr": "केळी", "hi": "केला"},
                    {"en": "Yelakki Banana", "mr": "इलायची केळी", "hi": "इलायची केला"},
                    {"en": "Apple", "mr": "सफरचंद", "hi": "सेब"},
                    {"en": "Mango", "mr": "आंबा", "hi": "आम"},
                    {"en": "Orange", "mr": "संत्री", "hi": "संतरा"},
                    {"en": "Pomegranate", "mr": "डाळिंब", "hi": "अनार"},
                    {"en": "Grapes", "mr": "द्राक्षे", "hi": "अंगूर"},
                    {"en": "Lemon", "mr": "लिंबू", "hi": "नींबू"},
                    {"en": "Chiku (Sapota)", "mr": "चिकू", "hi": "चीकू"},
                    {"en": "Custard Apple", "mr": "सीताफळ", "hi": "सीताफल"},
                    {"en": "Jackfruit", "mr": "फणस", "hi": "कटहल"},
                    {"en": "Watermelon", "mr": "कलिंगड", "hi": "तरबूज"},
                    {"en": "Muskmelon", "mr": "खरबूज", "hi": "खरबूजा"},
                    {"en": "Pineapple", "mr": "अननस", "hi": "अनानास"},
                    {"en": "Strawberry", "mr": "स्ट्रॉबेरी", "hi": "स्ट्रॉबेरी"},
                    {"en": "Jamun", "mr": "जांभूळ", "hi": "जामुन"},
                    {"en": "Fig (Fresh)", "mr": "अंजीर", "hi": "अंजीर"},
                    {"en": "Coconut", "mr": "नारळ", "hi": "नारियल"}
                ]
            }
        }
    },
    "BAKERY": {
        "display_name": "🍞 BAKERY & READY COOK",
        "subcategories": {
            "bakery_items": {
                "display_name": "🍞 Bakery Items",
                "color": "bg-amber-100",
                "category": "bakery",
                "items": [
                    {"en": "Bread", "mr": "ब्रेड", "hi": "ब्रेड"},
                    {"en": "Brown Bread", "mr": "ब्राउन ब्रेड", "hi": "ब्राउन ब्रेड"},
                    {"en": "Pav", "mr": "पाव", "hi": "पाव"},
                    {"en": "Bun", "mr": "बन", "hi": "बन"},
                    {"en": "Pizza Base", "mr": "पिझ्झा बेस", "hi": "पिज्जा बेस"},
                    {"en": "Pasta", "mr": "पास्ता", "hi": "पास्ता"},
                    {"en": "Macaroni", "mr": "मॅकरोनी", "hi": "मैकरोनी"},
                    {"en": "Spaghetti", "mr": "स्पॅघेटी", "hi": "स्पेगेटी"},
                    {"en": "Pizza Sauce", "mr": "पिझ्झा सॉस", "hi": "पिज्जा सॉस"},
                    {"en": "Oregano", "mr": "ओरेगॅनो", "hi": "ओरेगैनो"},
                    {"en": "Chilli Flakes", "mr": "चिली फ्लेक्स", "hi": "चिली फ्लेक्स"},
                    {"en": "Baking Soda", "mr": "खाण्याचा सोडा", "hi": "बेकिंग सोडा", "aliases": ["Soda", "Khanayacha Soda"], "monthly_qty": 50},
                    {"en": "Baking Powder", "mr": "बेकिंग पावडर", "hi": "बेकिंग पाउडर"},
                    {"en": "Custard Powder", "mr": "कस्टर्ड पावडर", "hi": "कस्टर्ड पाउडर"},
                    {"en": "Eno Fruit Salt", "mr": "इनो फ्रूट सॉल्ट", "hi": "ईनो फ्रूट सॉल्ट", "aliases": ["Eno"]}
                ]
            }
        }
    },
    "DAIRY": {
        "display_name": "🥛 DAIRY",
        "subcategories": {
            "dairy_products": {
                "display_name": "🥛 Dairy Products",
                "color": "bg-blue-50",
                "category": "dairy",
                "items": [
                    {"en": "Milk", "mr": "दूध", "hi": "दूध", "aliases": ["Doodh"], "monthly_qty": 15000},
                    {"en": "Curd", "mr": "दही", "hi": "दही", "aliases": ["Dahi", "Yogurt"], "monthly_qty": 2000, "unit_override": "ml"},
                    {"en": "Paneer", "mr": "पनीर", "hi": "पनीर"},
                    {"en": "Butter", "mr": "लोणी", "hi": "मक्खन"},
                    {"en": "Cheese", "mr": "चीज", "hi": "चीज"},
                    {"en": "Cream", "mr": "क्रीम", "hi": "क्रीम"},
                    {"en": "Buttermilk", "mr": "ताक", "hi": "छाछ"}
                ]
            }
        }
    },
    "HOUSEHOLD": {
        "display_name": "🧹 CLEANING & HOUSEHOLD (सफाई)",
        "subcategories": {
            "dish_laundry": {
                "display_name": "🧼 Dish & Laundry Cleaning",
                "color": "bg-blue-50",
                "category": "household",
                "items": [
                    {"en": "Dish Soap", "mr": "भांडी साबण", "hi": "बर्तन साबुन"},
                    {"en": "Dishwashing Liquid (Vim)", "mr": "विम बार / लिक्विड", "hi": "विम"},
                    {"en": "Dishwashing Bar", "mr": "भांडी धुण्याची बार", "hi": "बर्तन बार"},
                    {"en": "Scrubber / Scotch-Brite", "mr": "स्क्रबर", "hi": "स्क्रबर"},
                    {"en": "Steel Wool", "mr": "लोखंडी जाळी", "hi": "स्टील वूल"},
                    {"en": "Cloth Soap", "mr": "कपडे धुण्याचा साबण", "hi": "कपड़े का साबुन"},
                    {"en": "Detergent Powder", "mr": "डिटर्जंट पावडर", "hi": "डिटर्जेंट पाउडर"},
                    {"en": "Detergent (Rin)", "mr": "रिन", "hi": "रिन"},
                    {"en": "Detergent (Surf Excel)", "mr": "सर्फ एक्सेल", "hi": "सर्फ एक्सेल"},
                    {"en": "Fabric Softener", "mr": "फॅब्रिक सॉफ्टनर", "hi": "फैब्रिक सॉफ्टनर"},
                    {"en": "Fabric Whitener (Ujala)", "mr": "उजाला", "hi": "उजाला"},
                    {"en": "Odopic", "mr": "ओडोपिक", "hi": "ओडोपिक"}
                ]
            },
            "personal_care": {
                "display_name": "🚿 Personal Care & Bath",
                "color": "bg-cyan-50",
                "category": "household",
                "items": [
                    {"en": "Bath Soap", "mr": "आंघोळीचा साबण", "hi": "नहाने का साबुन"},
                    {"en": "Handwash", "mr": "हँडवॉश", "hi": "हैंडवॉश"},
                    {"en": "Shampoo", "mr": "शाम्पू", "hi": "शैम्पू"},
                    {"en": "Conditioner", "mr": "कंडिशनर", "hi": "कंडीशनर"},
                    {"en": "Body Oil", "mr": "अंगाला लावायचे तेल", "hi": "बॉडी ऑयल"},
                    {"en": "Hair Oil", "mr": "केसांचे तेल", "hi": "बालों का तेल"},
                    {"en": "Coconut Oil (Body)", "mr": "खोबरेल तेल", "hi": "नारियल तेल"},
                    {"en": "Body Lotion", "mr": "बॉडी लोशन", "hi": "बॉडी लोशन"},
                    {"en": "Face Wash", "mr": "फेस वॉश", "hi": "फेस वॉश"},
                    {"en": "Toothpaste", "mr": "टूथपेस्ट", "hi": "टूथपेस्ट"},
                    {"en": "Toothbrush", "mr": "टूथब्रश", "hi": "टूथब्रश"}
                ]
            },
            "bathroom_floor": {
                "display_name": "🚽 Bathroom & Floor Cleaning",
                "color": "bg-teal-50",
                "category": "household",
                "items": [
                    {"en": "Bathroom Cleaner", "mr": "बाथरूम क्लीनर", "hi": "बाथरूम क्लीनर"},
                    {"en": "Harpic", "mr": "हार्पिक", "hi": "हार्पिक"},
                    {"en": "Floor Cleaner", "mr": "फ्लोर क्लीनर", "hi": "फ्लोर क्लीनर"},
                    {"en": "Phenyl", "mr": "फिनाइल", "hi": "फिनाइल"},
                    {"en": "Lizol", "mr": "लिझॉल", "hi": "लाइजोल"},
                    {"en": "Toilet Cleaner Brush", "mr": "टॉयलेट ब्रश", "hi": "टॉयलेट ब्रश"},
                    {"en": "Mop", "mr": "पोछा", "hi": "पोछा"},
                    {"en": "Broom", "mr": "झाडू", "hi": "झाड़ू"},
                    {"en": "Dustpan", "mr": "कचरा उचलणारे", "hi": "कूड़ादान"}
                ]
            },
            "other_household": {
                "display_name": "✨ Other Household Essentials",
                "color": "bg-indigo-50",
                "category": "household",
                "items": [
                    {"en": "Glass Cleaner (Colin)", "mr": "कॉलिन", "hi": "कॉलिन"},
                    {"en": "Surface Cleaner", "mr": "सर्फेस क्लीनर", "hi": "सरफेस क्लीनर"},
                    {"en": "Air Freshener", "mr": "एअर फ्रेशनर", "hi": "एयर फ्रेशनर"},
                    {"en": "Insect Killer Spray", "mr": "कीटकनाशक स्प्रे", "hi": "कीटनाशक स्प्रे"},
                    {"en": "Mosquito Repellent", "mr": "मच्छर अगरबत्ती", "hi": "मच्छर भगाने वाला"},
                    {"en": "Naphthalene Balls", "mr": "नॅप्थलीन गोळ्या", "hi": "नेफ्थलीन गोलियां"},
                    {"en": "Camphor (Kapoor)", "mr": "कापूर", "hi": "कपूर"},
                    {"en": "Matchsticks", "mr": "काडेपेटी", "hi": "माचिस"},
                    {"en": "Candles", "mr": "मेणबत्ती", "hi": "मोमबत्ती"},
                    {"en": "Garbage Bags", "mr": "कचरा पिशव्या", "hi": "कचरा बैग"},
                    {"en": "Aluminum Foil", "mr": "अल्युमिनियम फॉइल", "hi": "एल्यूमीनियम फॉइल"},
                    {"en": "Cling Wrap", "mr": "क्लिंग रॅप", "hi": "क्लिंग रैप"},
                    {"en": "Paper Napkins", "mr": "पेपर नॅपकिन", "hi": "पेपर नैपकिन"},
                    {"en": "Tissues", "mr": "टिश्यू पेपर", "hi": "टिश्यू पेपर"}
                ]
            }
        }
    }
}

# Essential items for new kitchen setup - comprehensive Indian kitchen inventory
# Based on curated list from active users
ESSENTIALS_LIST = [
    # Grains & Flours
    "Rice", "Basmati Rice", "Wheat", "Wheat Flour", "Rice Flour",
    "Jowar Flour", "Rava", "Roasted Rava", "Gram Flour", "Maida",
    "Corn Flour (Makai Atta)", "Dalia (Broken Wheat)", "Poha",
    # Pulses
    "Toor Dal", "Moong Dal", "Moong Dal (Split)", "Chana Dal", "Masoor Dal",
    # Spices (Whole)
    "Salt", "Turmeric Powder", "Red Chili Powder", "Coriander Seeds",
    "Coriander Powder", "Cumin Seeds", "Mustard Seeds",
    "Bay Leaf", "Nutmeg", "Dry Ginger", "Poppy Seeds",
    "Green Cardamom", "Black Cardamom", "Kasoori Methi",
    # Ready Masalas
    "Garam Masala", "Chaat Masala", "Chhole Masala",
    "Pav Bhaji Masala", "Sambhar Masala",
    # Oils
    "Groundnut Oil", "Sunflower Oil", "Ghee",
    # Dairy
    "Milk",
    # Sweeteners
    "Sugar", "Jaggery",
    # Beverages
    "Tea Leaves", "Coffee Powder",
    # Fasting Items
    "Sabudana", "Groundnuts", "Vari Rice", "Rajgira Lahi",
    # Condiments
    "Tamarind", "Coconut (Grated)",
    # Bakery & Baking
    "Baking Soda", "Eno Fruit Salt", "Custard Powder",
    # Dry Fruits & Nuts
    "Cashews", "Almonds", "Walnuts", "Supari", "Mukhwas",
    # Snacks
    "Boondi", "Bhujiya Sev",
    # Vegetables
    "Potato", "Cabbage", "Capsicum", "Cauliflower"
]


import unicodedata


def _normalize_name(s: str) -> str:
    """Lowercase, strip, NFC-normalize for cross-script comparison."""
    if not s:
        return ""
    return unicodedata.normalize("NFC", s).strip().lower()


# Built once on import: maps any en/mr/hi/alias variant -> canonical English name.
_NAME_TO_EN: dict = {}


def _build_name_lookup():
    for main_data in PANTRY_TEMPLATE.values():
        for sub_data in main_data["subcategories"].values():
            for item in sub_data["items"]:
                en = item["en"]
                for variant in (en, item.get("mr"), item.get("hi"), *(item.get("aliases") or [])):
                    key = _normalize_name(variant)
                    if key:
                        _NAME_TO_EN.setdefault(key, en)


_build_name_lookup()


def to_canonical_en(name: str) -> str:
    """Resolve any en/mr/hi/alias name to its canonical English name.

    Returns the input unchanged if no match is found, so callers can still
    fall back to substring matching for items not in the catalog.
    """
    if not name:
        return name
    return _NAME_TO_EN.get(_normalize_name(name), name)


def get_item_details(item_name: str) -> dict:
    """Get full details for an item by name (en/mr/hi/alias all accepted)."""
    canonical = _NAME_TO_EN.get(_normalize_name(item_name))
    if not canonical:
        return None
    for main_data in PANTRY_TEMPLATE.values():
        for sub_data in main_data["subcategories"].values():
            category = sub_data["category"]
            for item in sub_data["items"]:
                if item["en"] == canonical:
                    unit = item.get("unit_override", CATEGORY_UNITS.get(category, "kg"))
                    return {
                        "name_en": item["en"],
                        "name_mr": item.get("mr", ""),
                        "name_hi": item.get("hi", ""),
                        "aliases": item.get("aliases", []),
                        "category": category,
                        "unit": unit,
                        "monthly_quantity": item.get("monthly_qty", 0)
                    }
    return None


def get_essentials_pack() -> list:
    """Get the essentials pack with full details"""
    essentials = []
    for name in ESSENTIALS_LIST:
        details = get_item_details(name)
        if details:
            essentials.append(details)
    return essentials


def get_pantry_template_for_frontend() -> dict:
    """
    Format pantry template for frontend consumption.
    Returns structured data with categories, items, and their units.
    """
    result = {}
    
    for main_key, main_data in PANTRY_TEMPLATE.items():
        main_display = main_data["display_name"]
        result[main_display] = {}
        
        for sub_key, sub_data in main_data["subcategories"].items():
            sub_display = sub_data["display_name"]
            category = sub_data["category"]
            base_unit = CATEGORY_UNITS.get(category, "kg")
            
            items = []
            for item in sub_data["items"]:
                unit = item.get("unit_override", base_unit)
                items.append({
                    "en": item["en"],
                    "mr": item.get("mr", ""),
                    "hi": item.get("hi", ""),
                    "category": category,
                    "unit": unit
                })
            
            result[main_display][sub_display] = {
                "color": sub_data["color"],
                "category": category,
                "items": items
            }
    
    return result
