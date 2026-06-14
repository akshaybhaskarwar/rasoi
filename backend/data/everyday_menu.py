"""
Everyday meal-component catalog.

Source: "Everyday Food options.xlsx" — a family-curated catalog of
Maharashtrian vegetarian meal components organized by slot (Roti, Dal,
Sabji, etc.). Imported once during Phase 1 of the menu-browse feature.

Cleaning applied during import:
  * Typos fixed:   "Jeera rica" -> "Jeera Rice", "Maida Nan" -> "Maida Naan",
                   "Ras gulla" -> "Rasgulla", "Ladies Fingure" -> "Ladies Finger",
                   "Marrinated Aloo" -> "Marinated Aloo", "rica" -> "rice".
  * De-dup:        e.g. "Dalva Chatni" appeared twice on sheet 4.
  * Matrix flatten: Sheet 7 ("Sabji or Bhaji") was a column-per-vegetable
                   matrix. Flattened to {dish, vegetable_tag}.
  * Combinations:  Sheet 12 stored comma-separated component lists per cell.
                   Parsed into composition records with slot/name pairs.
  * Bilingual:     Each dish gets name_en (canonical) + name_mr (Devanagari
                   where known) + aliases (transliterations). Items marked
                   `mr=""` are unknown — flagged for user/admin review.

Sheet 11 was empty; dropped.

Categories surfaced to the UI:
  Chapati, Dal, Sabji, Rice, Koshimbhir, Chatni, KadhiSaar, Gole, Gravies
Plus two composed-meal sections:
  PartyTime, Combinations
"""

# ----------------------------------------------------------------------------- #
# Single-component dishes — one per dict, organized by slot/category.            #
# ----------------------------------------------------------------------------- #

CHAPATI = [
    {"en": "Fulka",                       "mr": "फुलका",                "aliases": ["Phulka"]},
    {"en": "Pandhari Poli",               "mr": "पांढरी पोळी",          "aliases": []},
    {"en": "Laccha Paratha",              "mr": "लच्छा पराठा",          "aliases": []},
    {"en": "Atta Naan",                   "mr": "आटा नान",              "aliases": ["Atta Nan"]},
    {"en": "Maida Naan",                  "mr": "मैदा नान",             "aliases": ["Maida Nan"]},
    {"en": "Missi Roti",                  "mr": "मिस्सी रोटी",          "aliases": []},
    {"en": "Bhakari",                     "mr": "भाकरी",                "aliases": ["Bhakri"]},
    {"en": "Corn Roti",                   "mr": "मक्याची रोटी",         "aliases": []},
    {"en": "Bajari Roti",                 "mr": "बाजरीची भाकरी",        "aliases": ["Bajra Roti"]},
    {"en": "Rice Flour Bhakari",          "mr": "तांदळाची भाकरी",        "aliases": ["Tandlachi Bhakri"]},
    {"en": "Dashmya",                     "mr": "दशम्या",               "aliases": []},
    {"en": "Puran Poli",                  "mr": "पुरण पोळी",            "aliases": []},
    {"en": "Puri",                        "mr": "पुरी",                 "aliases": []},
    {"en": "Palak Puri",                  "mr": "पालक पुरी",            "aliases": ["Spinach Puri"]},
    {"en": "Tikhat Puri",                 "mr": "तिखट पुरी",            "aliases": ["Spicy Puri"]},
    {"en": "Palak Paratha",               "mr": "पालक पराठा",           "aliases": ["Spinach Paratha"]},
    {"en": "Beetroot Paratha",            "mr": "बीटरूट पराठा",          "aliases": []},
    {"en": "Aloo Paratha",                "mr": "बटाटा पराठा",          "aliases": ["Potato Paratha"]},
    {"en": "Tomato Paratha",              "mr": "टोमॅटो पराठा",         "aliases": []},
    {"en": "Peas Paratha",                "mr": "मटार पराठा",           "aliases": ["Matar Paratha"]},
    {"en": "Methi Paratha",               "mr": "मेथी पराठा",           "aliases": ["Fenugreek Paratha"]},
    {"en": "Carrot Paratha",              "mr": "गाजर पराठा",           "aliases": []},
    {"en": "Paneer Cauliflower Paratha",  "mr": "पनीर फुलकोबी पराठा",   "aliases": []},
    {"en": "Cabbage Paratha",             "mr": "कोबी पराठा",           "aliases": []},
    {"en": "Radish Paratha",              "mr": "मुळा पराठा",           "aliases": ["Mooli Paratha", "Raddish Paratha"]},
    {"en": "Drumstick Leaves Paratha",    "mr": "शेवग्याच्या पाल्याचा पराठा", "aliases": []},
    {"en": "Cauliflower Paratha",         "mr": "फुलकोबी पराठा",         "aliases": []},
    {"en": "Paneer Onion Paratha",        "mr": "पनीर कांदा पराठा",      "aliases": []},
]

DAL = [
    {"en": "Tamarind Jaggery Dal",        "mr": "चिंच गुळ डाळ",          "aliases": ["Chinch Gul Dal"]},
    {"en": "Lemon Dal",                   "mr": "लिंबू डाळ",             "aliases": ["Limbu Dal"]},
    {"en": "Tomato Dal",                  "mr": "टोमॅटो डाळ",           "aliases": []},
    {"en": "Curd Dal",                    "mr": "दही डाळ",              "aliases": ["Dahi Dal"]},
    {"en": "Mango Powder Dal",            "mr": "आमचूर डाळ",            "aliases": ["Amchur Dal"]},
    {"en": "Kokum Dal",                   "mr": "कोकम डाळ",             "aliases": []},
    {"en": "Kairi Dal",                   "mr": "कैरी डाळ",             "aliases": ["Raw Mango Dal"]},
    {"en": "Moong Dal Varan",             "mr": "मूग डाळ वरण",          "aliases": []},
    {"en": "Toor Dal Varan",              "mr": "तूर डाळ वरण",          "aliases": ["Arhar Dal Varan"]},
    {"en": "Urad Dal Varan",              "mr": "उडीद डाळ वरण",          "aliases": []},
    {"en": "Bhajlela Ghatta Varan",       "mr": "भाजलेला घट्ट वरण",      "aliases": ["Fried Thick Dal"]},
    {"en": "Ambadi Dal",                  "mr": "अंबाडी डाळ",           "aliases": []},
    {"en": "Kaccha Varan",                "mr": "कच्चा वरण",            "aliases": []},
    {"en": "Sambar",                      "mr": "सांबार",               "aliases": []},
    {"en": "Watermelon Dal Bhaji",        "mr": "कलिंगड डाळ भाजी",      "aliases": ["Dal vang'watermellon"]},
    {"en": "Moong Dal Bhaji",             "mr": "मूग डाळ भाजी",         "aliases": []},
    {"en": "Mix Dal Varan",               "mr": "मिक्स डाळ वरण",        "aliases": []},
    {"en": "Dal Makhani",                 "mr": "दाल मखनी",             "aliases": []},
    {"en": "Masoor Dal Varan",            "mr": "मसूर डाळ वरण",          "aliases": []},
    {"en": "Green Peas Amti",             "mr": "हिरवे मटार आमटी",       "aliases": []},
    {"en": "Toor Dal Amti",               "mr": "तूर डाळ आमटी",         "aliases": []},
    {"en": "Dal Fry",                     "mr": "डाळ फ्राय",            "aliases": []},
    {"en": "Dal Tadka",                   "mr": "डाळ तडका",             "aliases": []},
]

GOLE = [
    # Small dumplings cooked in/with dal or gravy
    {"en": "Varanatle Gole",              "mr": "वरणातले गोळे",         "aliases": []},
    {"en": "Takatle Gole",                "mr": "ताकातले गोळे",         "aliases": []},
    {"en": "Dodkyatle Gole",              "mr": "दोडक्यातले गोळे",       "aliases": []},
    {"en": "Varan Fal",                   "mr": "वरण फळ",               "aliases": []},
    {"en": "Methi Fal",                   "mr": "मेथी फळ",              "aliases": []},
]

CHATNI = [
    {"en": "Groundnut Chatni",            "mr": "शेंगदाणा चटणी",         "aliases": ["Shengdana Chatni"]},
    {"en": "Sesame Chatni",               "mr": "तीळ चटणी",             "aliases": ["Til Chatni"]},
    {"en": "Coconut Chatni",              "mr": "खोबरे चटणी",           "aliases": ["Khobra Chatni"]},
    {"en": "Groundnut Sesame Coconut Chatni", "mr": "शेंगदाणा तीळ खोबरे चटणी", "aliases": []},
    {"en": "Miram Chatni",                "mr": "मिराम चटणी",           "aliases": []},
    {"en": "Dalva Chatni",                "mr": "दलवा चटणी",            "aliases": []},
    {"en": "Curry Leaves Chatni",         "mr": "कढीपत्ता चटणी",         "aliases": []},
    {"en": "Boondi Chatni",               "mr": "बुंदी चटणी",            "aliases": []},
    {"en": "Red Chilli Thecha",           "mr": "लाल मिरची ठेचा",        "aliases": []},
    {"en": "Green Chilli Thecha",         "mr": "हिरवी मिरची ठेचा",       "aliases": []},
    {"en": "Dodka Chatni",                "mr": "दोडका चटणी",           "aliases": ["Ridge Gourd Chatni"]},
    {"en": "Green Tomato Chatni",         "mr": "हिरवा टोमॅटो चटणी",    "aliases": []},
    {"en": "Red Tomato Chatni",           "mr": "लाल टोमॅटो चटणी",     "aliases": []},
    {"en": "Lasun Tikhat",                "mr": "लसूण तिखट",            "aliases": ["Garlic Tikhat"]},
    {"en": "Green Chilli Chatni",         "mr": "हिरवी मिरची चटणी",      "aliases": []},
    {"en": "Kairi Chatni",                "mr": "कैरी चटणी",            "aliases": ["Raw Mango Chatni"]},
    {"en": "Methkut Chatni",              "mr": "मेथकूट",               "aliases": []},
    {"en": "Panchamrut",                  "mr": "पंचामृत",              "aliases": []},
    {"en": "Tondle Chatni",               "mr": "तोंडल्याची चटणी",       "aliases": []},
    {"en": "Brinjal Tomato Chatni",       "mr": "वांगे टोमॅटो चटणी",     "aliases": ["Vange Tomato Chatni"]},
    {"en": "Ambat God Chatni",            "mr": "आंबट गोड चटणी",         "aliases": ["Sweet-Sour Chatni"]},
    {"en": "Tamarind Chatni",             "mr": "चिंच चटणी",            "aliases": ["Chinch Chatni"]},
    {"en": "Pudina Chatni",               "mr": "पुदिना चटणी",          "aliases": ["Mint Chatni"]},
    {"en": "Karal",                       "mr": "कारळ",                 "aliases": []},
    {"en": "Kavath",                      "mr": "कवठ",                  "aliases": []},
    {"en": "Javas",                       "mr": "जवस",                  "aliases": ["Flax Seeds Chatni"]},
    {"en": "Red Chatni",                  "mr": "लाल चटणी",             "aliases": []},
    {"en": "Green Chatni",                "mr": "हिरवी चटणी",            "aliases": []},
    {"en": "Dosa Chatni",                 "mr": "डोसा चटणी",            "aliases": []},
]

KOSHIMBHIR = [
    {"en": "Spinach Cauliflower Koshimbhir", "mr": "पालक फुलकोबी कोशिंबीर", "aliases": []},
    {"en": "Onion Curd Koshimbhir",       "mr": "कांदा दही कोशिंबीर",     "aliases": []},
    {"en": "Carrot Lemon Koshimbhir",     "mr": "गाजर लिंबू कोशिंबीर",    "aliases": []},
    {"en": "Beetroot Koshimbhir",         "mr": "बीटरूट कोशिंबीर",       "aliases": []},
    {"en": "Beetroot Curd Koshimbhir",    "mr": "बीटरूट दही कोशिंबीर",   "aliases": []},
    {"en": "Radish Koshimbhir",           "mr": "मुळा कोशिंबीर",         "aliases": ["Mooli Koshimbhir"]},
    {"en": "Radish Curd Koshimbhir",      "mr": "मुळा दही कोशिंबीर",     "aliases": []},
    {"en": "Cucumber Koshimbhir",         "mr": "काकडी कोशिंबीर",        "aliases": ["Kakdi Koshimbhir"]},
    {"en": "Cucumber Onion Tomato Koshimbhir", "mr": "काकडी कांदा टोमॅटो कोशिंबीर", "aliases": []},
    {"en": "Chana Dalimb Koshimbhir",     "mr": "चणा डाळिंब कोशिंबीर",   "aliases": ["Chana Pomegranate"]},
    {"en": "Moong Dal Koshimbhir",        "mr": "मूग डाळ कोशिंबीर",      "aliases": []},
    {"en": "Capsicum Koshimbhir",         "mr": "ढोबळी मिरची कोशिंबीर",  "aliases": []},
    {"en": "Spinach Chakka Koshimbhir",   "mr": "पालक चक्का कोशिंबीर",   "aliases": ["Spinach Curd Koshimbhir"]},
]

RICE = [
    {"en": "Pulav",                       "mr": "पुलाव",                "aliases": ["Pulao"]},
    {"en": "Gola Bhaat",                  "mr": "गोळा भात",             "aliases": []},
    {"en": "Tamarind Rice",               "mr": "चिंच भात",             "aliases": ["Chinch Bhaat"]},
    {"en": "Ambe Bhaat",                  "mr": "आंबे भात",             "aliases": ["Mango Rice"]},
    {"en": "Lemon Rice",                  "mr": "लिंबू भात",            "aliases": ["Limbu Bhaat"]},
    {"en": "Cheese Corn Pulav",           "mr": "चीज कॉर्न पुलाव",      "aliases": []},
    {"en": "Biryani",                     "mr": "बिर्याणी",              "aliases": []},
    {"en": "Spinach Pulav",               "mr": "पालक पुलाव",            "aliases": ["Palak Pulav"]},
    {"en": "Simple Khichadi",             "mr": "साधी खिचडी",            "aliases": []},
    {"en": "Masala Khichadi",             "mr": "मसाला खिचडी",          "aliases": []},
    {"en": "Dal Khichadi",                "mr": "दाल खिचडी",            "aliases": []},
    {"en": "Jeera Rice",                  "mr": "जिरा भात",             "aliases": ["Cumin Rice"]},
    {"en": "Dahi Bhaat",                  "mr": "दही भात",              "aliases": ["Curd Rice"]},
    {"en": "Green Peas Pulav",            "mr": "मटार पुलाव",           "aliases": ["Matar Pulav"]},
    {"en": "Fodnichi Khichadi",           "mr": "फोडणीची खिचडी",         "aliases": []},
    {"en": "Khichada Saar",               "mr": "खिचडा सार",             "aliases": []},
    {"en": "Tondale Bhaat",               "mr": "तोंडले भात",           "aliases": ["Ivy Gourd Rice"]},
    {"en": "Vange Bhaat",                 "mr": "वांगे भात",            "aliases": ["Brinjal Rice"]},
    {"en": "Pongal",                      "mr": "पोंगल",                "aliases": []},
    {"en": "Cabbage Rice",                "mr": "कोबी भात",             "aliases": []},
    {"en": "Jackfruit Biryani",           "mr": "फणस बिर्याणी",         "aliases": ["Fanas Biryani"]},
    {"en": "Veg Biryani",                 "mr": "व्हेज बिर्याणी",       "aliases": []},
    {"en": "Dane Bhaat",                  "mr": "डाणे भात",             "aliases": []},
    {"en": "Gobhi Bhaat",                 "mr": "फुलकोबी भात",          "aliases": []},
]

# ----------------------------------------------------------------------------- #
# Sabji (vegetable dishes) — original sheet was a matrix where each column was   #
# a vegetable. Flattened with explicit `vegetable_tag` so the UI can filter      #
# "show me brinjal sabjis" etc.                                                  #
# ----------------------------------------------------------------------------- #

SABJI = [
    # ---- BRINJAL / Vange ----
    {"en": "Vange Popti Misal Bhaji",     "mr": "वांगे पोपटी मिसळ भाजी", "vegetable": "Brinjal", "aliases": []},
    {"en": "Vange Dal",                   "mr": "वांगे डाळ",            "vegetable": "Brinjal", "aliases": []},
    {"en": "Bharlele Vange",              "mr": "भरलेले वांगे",         "vegetable": "Brinjal", "aliases": ["Stuffed Brinjal"]},
    {"en": "Aloo Vange Tamatar",          "mr": "बटाटा वांगे टोमॅटो",    "vegetable": "Brinjal", "aliases": ["Potato Brinjal Tomato"]},
    {"en": "Sukhi Vange Bhaji",           "mr": "सुकी वांगे भाजी",       "vegetable": "Brinjal", "aliases": ["Dry Brinjal"]},
    {"en": "Vange Bharit",                "mr": "वांगे भरीत",           "vegetable": "Brinjal", "aliases": ["Bharit"]},
    {"en": "Vange Mirchi Sambar",         "mr": "वांगे मिरची सांबार",   "vegetable": "Brinjal", "aliases": []},
    {"en": "Vangyache Dudhachi Bhaji",    "mr": "वांग्याची दुधाची भाजी",  "vegetable": "Brinjal", "aliases": []},
    {"en": "Chapte Vange with Curd",      "mr": "चपटे वांगे दह्यासह",    "vegetable": "Brinjal", "aliases": []},
    {"en": "Chapte Vange without Curd",   "mr": "चपटे वांगे दह्याशिवाय", "vegetable": "Brinjal", "aliases": []},
    {"en": "Kelvangyachi Bhaji",          "mr": "केळ्वांग्याची भाजी",     "vegetable": "Brinjal", "aliases": []},
    # ---- LADIES FINGER / Bhindi ----
    {"en": "Masala Bhindi",               "mr": "मसाला भेंडी",          "vegetable": "Bhindi", "aliases": []},
    {"en": "Dahi Bhindi",                 "mr": "दही भेंडी",            "vegetable": "Bhindi", "aliases": []},
    {"en": "Crispy Bhindi",               "mr": "क्रिस्पी भेंडी",        "vegetable": "Bhindi", "aliases": []},
    {"en": "Besan Bhindi",                "mr": "बेसन भेंडी",           "vegetable": "Bhindi", "aliases": []},
    {"en": "Kathiyavadi Bhindi",          "mr": "काठियावाडी भेंडी",      "vegetable": "Bhindi", "aliases": []},
    {"en": "Rassewali Bhindi",            "mr": "रसेवाली भेंडी",         "vegetable": "Bhindi", "aliases": ["Gravy Bhindi"]},
    {"en": "Chincha Bhindi",              "mr": "चिंचेची भेंडी",         "vegetable": "Bhindi", "aliases": ["Tamarind Bhindi"]},
    {"en": "Bhindiche Alan",              "mr": "भेंडीचे आळण",          "vegetable": "Bhindi", "aliases": []},
    # ---- POTATO / Aloo ----
    {"en": "Sukhi Dosa Bhaji",            "mr": "सुकी डोसा भाजी",        "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Onion Capsicum",         "mr": "बटाटा कांदा ढोबळी",      "vegetable": "Aloo", "aliases": []},
    {"en": "Dahi Aloo Rasse Bhaji",       "mr": "दही बटाटा रसे भाजी",    "vegetable": "Aloo", "aliases": []},
    {"en": "Universal Gravy Aloo Bhaji",  "mr": "युनिवर्सल ग्रेव्ही बटाटा भाजी", "vegetable": "Aloo", "aliases": []},
    {"en": "Kachryachi Bhaji",            "mr": "काचऱ्याची भाजी",        "vegetable": "Aloo", "aliases": []},
    {"en": "Kaccha Masala Rassa Aloo",    "mr": "कच्चा मसाला रसा बटाटा", "vegetable": "Aloo", "aliases": []},
    {"en": "Bharlele Aloo",               "mr": "भरलेले बटाटे",          "vegetable": "Aloo", "aliases": ["Stuffed Potato"]},
    {"en": "Dum Aloo",                    "mr": "दम आलू",               "vegetable": "Aloo", "aliases": []},
    {"en": "Marinated Aloo",              "mr": "मॅरिनेटेड बटाटा",       "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Vange",                  "mr": "बटाटा वांगे",          "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Bhindi",                 "mr": "बटाटा भेंडी",          "vegetable": "Aloo", "aliases": []},
    {"en": "Gram Flour Aloo",             "mr": "बेसन बटाटा",           "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Khobra",                 "mr": "बटाटा खोबरे",          "vegetable": "Aloo", "aliases": []},
    {"en": "Simple Aloo Bhaji",           "mr": "साधी बटाटा भाजी",       "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Ghee Bhaji",             "mr": "बटाटा तुपाची भाजी",     "vegetable": "Aloo", "aliases": []},
    {"en": "Aloo Chips Bhaji",            "mr": "बटाटा चिप्स भाजी",      "vegetable": "Aloo", "aliases": []},
    {"en": "Fingure Chips",               "mr": "फिंगर चिप्स",          "vegetable": "Aloo", "aliases": ["Finger Chips"]},
    # ---- IVY GOURD / Tondale ----
    {"en": "Sukhi Tondale",               "mr": "सुकी तोंडली",           "vegetable": "Tondale", "aliases": []},
    {"en": "Bharleli Tondale",            "mr": "भरलेली तोंडली",         "vegetable": "Tondale", "aliases": ["Stuffed Ivy Gourd"]},
    {"en": "Rassewali Tondale",           "mr": "रसेवाली तोंडली",        "vegetable": "Tondale", "aliases": []},
    # ---- PARVAL / Pointed gourd ----
    {"en": "Sukhi Parval",                "mr": "सुकी परवल",            "vegetable": "Parval", "aliases": []},
    {"en": "Bharleli Parval",             "mr": "भरलेली परवल",          "vegetable": "Parval", "aliases": []},
    {"en": "Rassewali Parval",            "mr": "रसेवाली परवल",         "vegetable": "Parval", "aliases": []},
    # ---- CAULIFLOWER ----
    {"en": "Cauliflower Potato",          "mr": "फुलकोबी बटाटा",         "vegetable": "Cauliflower", "aliases": []},
    {"en": "Cauliflower Green Peas",      "mr": "फुलकोबी मटार",         "vegetable": "Cauliflower", "aliases": []},
    {"en": "Cauliflower Carrot Peas",     "mr": "फुलकोबी गाजर मटार",    "vegetable": "Cauliflower", "aliases": []},
    # ---- CABBAGE ----
    {"en": "Cabbage Potato Peas Carrot",  "mr": "कोबी बटाटा मटार गाजर",  "vegetable": "Cabbage", "aliases": []},
    {"en": "Simple Cabbage Bhaji",        "mr": "साधी कोबी भाजी",        "vegetable": "Cabbage", "aliases": []},
    {"en": "Chana Dal Cabbage",           "mr": "चणा डाळ कोबी",         "vegetable": "Cabbage", "aliases": []},
    {"en": "Moong Dal Cabbage",           "mr": "मूग डाळ कोबी",         "vegetable": "Cabbage", "aliases": []},
    {"en": "Besan Cabbage",               "mr": "बेसन कोबी",            "vegetable": "Cabbage", "aliases": []},
    {"en": "Jhunka Cabbage",              "mr": "झुणका कोबी",           "vegetable": "Cabbage", "aliases": []},
    {"en": "Matar Cabbage",               "mr": "मटार कोबी",            "vegetable": "Cabbage", "aliases": []},
    {"en": "Aloo Cabbage",                "mr": "बटाटा कोबी",           "vegetable": "Cabbage", "aliases": []},
    # ---- KOHALA / Ash gourd ----
    {"en": "Kohala Tamarind Jaggery",     "mr": "कोहळा चिंच गुळ",        "vegetable": "Kohala", "aliases": []},
    {"en": "Gram Flour Kohala",           "mr": "बेसन कोहळा",           "vegetable": "Kohala", "aliases": []},
    {"en": "Kofta Kohala",                "mr": "कोफ्ता कोहळा",         "vegetable": "Kohala", "aliases": []},
    # ---- DODKA / Ridge gourd ----
    {"en": "Dry Dodka",                   "mr": "सुका दोडका",           "vegetable": "Dodka", "aliases": []},
    {"en": "Bharlele Dodke",              "mr": "भरलेले दोडके",          "vegetable": "Dodka", "aliases": ["Stuffed Ridge Gourd"]},
    {"en": "Moong Dal Dodka",             "mr": "मूग डाळ दोडका",         "vegetable": "Dodka", "aliases": []},
    {"en": "Chana Dal Dodka",             "mr": "चणा डाळ दोडका",         "vegetable": "Dodka", "aliases": []},
    # ---- BEANS / Shenga ----
    {"en": "Chavli Shenga",               "mr": "चवळी शेंगा",           "vegetable": "Beans", "aliases": []},
    {"en": "Val Shenga",                  "mr": "वाल शेंगा",            "vegetable": "Beans", "aliases": []},
    {"en": "Gavar Shenga",                "mr": "गवार शेंगा",           "vegetable": "Beans", "aliases": []},
    # ---- LEAFY GREENS ----
    {"en": "Methi Simple",                "mr": "साधी मेथी",             "vegetable": "GreenLeafy", "aliases": ["Fenugreek Simple"]},
    {"en": "Methi Gholana",               "mr": "मेथी घोळणा",           "vegetable": "GreenLeafy", "aliases": []},
    {"en": "Methi Patal Dal Bhaji",       "mr": "मेथी पातळ डाळ भाजी",    "vegetable": "GreenLeafy", "aliases": []},
    {"en": "Methi Toor Dal Bhaji",        "mr": "मेथी तूर डाळ भाजी",    "vegetable": "GreenLeafy", "aliases": []},
    {"en": "Dhopa Dal Bhaji",             "mr": "धोपा डाळ भाजी",        "vegetable": "GreenLeafy", "aliases": []},
    {"en": "Chavali Math Green",          "mr": "चवळी माठ हिरवी",        "vegetable": "GreenLeafy", "aliases": []},
    {"en": "Palak Bhaji",                 "mr": "पालक भाजी",            "vegetable": "GreenLeafy", "aliases": ["Spinach Bhaji"]},
    {"en": "Shepu Bhaji",                 "mr": "शेपू भाजी",             "vegetable": "GreenLeafy", "aliases": ["Dill"]},
    {"en": "Chavali Math Red",            "mr": "चवळी माठ लाल",          "vegetable": "GreenLeafy", "aliases": []},
    # ---- BESAN / Gram Flour ----
    {"en": "Jhunka with Capsicum",        "mr": "झुणका ढोबळी मिरचीसह",   "vegetable": "Besan", "aliases": []},
    {"en": "Jhunka without Capsicum",     "mr": "झुणका साधा",            "vegetable": "Besan", "aliases": []},
    {"en": "Stuffed Capsicum",            "mr": "भरलेली ढोबळी मिरची",    "vegetable": "Besan", "aliases": []},
    {"en": "Jhunka Methi",                "mr": "झुणका मेथी",            "vegetable": "Besan", "aliases": []},
    {"en": "Jhunka Ghol",                 "mr": "झुणका घोळ",             "vegetable": "Besan", "aliases": []},
    {"en": "Patal Pithla",                "mr": "पातळ पिठलं",            "vegetable": "Besan", "aliases": []},
    {"en": "Baska Pithla",                "mr": "बसका पिठलं",           "vegetable": "Besan", "aliases": []},
    {"en": "Ghatta Pithla",               "mr": "घट्ट पिठलं",            "vegetable": "Besan", "aliases": []},
    {"en": "Patavadi",                    "mr": "पाटवडी",               "vegetable": "Besan", "aliases": []},
    # ---- DUDHI / Bottle Gourd ----
    {"en": "Bottle Gourd Milk",           "mr": "दुधी दुधासह",           "vegetable": "Dudhi", "aliases": []},
    {"en": "Bottle Gourd Khaskhas Coconut", "mr": "दुधी खसखस खोबरे",     "vegetable": "Dudhi", "aliases": []},
    {"en": "Bottle Gourd Kofta",          "mr": "दुधी कोफ्ता",           "vegetable": "Dudhi", "aliases": []},
    {"en": "Chana Dal Bottle Gourd",      "mr": "चणा डाळ दुधी",         "vegetable": "Dudhi", "aliases": []},
    # ---- FANAS / Jackfruit ----
    {"en": "Jackfruit Dry",               "mr": "सुका फणस",             "vegetable": "Fanas", "aliases": []},
    {"en": "Jackfruit Rassa",             "mr": "फणस रसा",              "vegetable": "Fanas", "aliases": []},
    {"en": "Chana Dal Tamarind Jaggery Fanas", "mr": "चणा डाळ चिंच गुळ फणस", "vegetable": "Fanas", "aliases": []},
    # ---- KATVAL / Spiny Gourd ----
    {"en": "Katval Dry",                  "mr": "सुका कटवल / कांटोळा",          "vegetable": "Katval", "aliases": ["Spiny Gourd Dry"]},
    {"en": "Katval Rassewali",            "mr": "रसेवाला कटवल / कांटोळा",       "vegetable": "Katval", "aliases": []},
    {"en": "Chana Dal Spiny Gourd",       "mr": "चणा डाळ कटवल / कांटोळा",       "vegetable": "Katval", "aliases": []},
    # ---- KARLE / Bitter Gourd ----
    {"en": "Karle Dry",                   "mr": "सुके कारले",            "vegetable": "Karle", "aliases": ["Bitter Gourd Dry"]},
    {"en": "Karle Curd Rassa",            "mr": "कारले दही रसा",         "vegetable": "Karle", "aliases": []},
    {"en": "Fried Karle",                 "mr": "तळलेले कारले",          "vegetable": "Karle", "aliases": []},
    {"en": "Karle Tamarind Jaggery",      "mr": "कारले चिंच गुळ",        "vegetable": "Karle", "aliases": []},
    {"en": "Bharlele Karle",              "mr": "भरलेले कारले",          "vegetable": "Karle", "aliases": ["Stuffed Bitter Gourd"]},
    {"en": "Moong Dal Besan Karle",       "mr": "मूग डाळ बेसन कारले",    "vegetable": "Karle", "aliases": []},
    # ---- SURAN / Elephant Foot ----
    {"en": "Ghatta Suran Bhaji",          "mr": "घट्ट सुरण भाजी",        "vegetable": "Suran", "aliases": []},
    {"en": "Fried Suran with Universal Curry", "mr": "तळलेला सुरण",      "vegetable": "Suran", "aliases": []},
    # ---- TOMATO ----
    {"en": "Kaccha Tomato Bhaji",         "mr": "कच्चा टोमॅटो भाजी",     "vegetable": "Tomato", "aliases": []},
    {"en": "Red Tomato Bhaji",            "mr": "लाल टोमॅटो भाजी",       "vegetable": "Tomato", "aliases": []},
    {"en": "Stuffed Tomato Bhaji",        "mr": "भरलेला टोमॅटो भाजी",    "vegetable": "Tomato", "aliases": []},
    {"en": "Shev Tomato Bhaji",           "mr": "शेव टोमॅटो भाजी",       "vegetable": "Tomato", "aliases": []},
    # ---- DHEMSA ----
    {"en": "Bharlele Dhemsa",             "mr": "भरलेले ढेमसे",         "vegetable": "Dhemsa", "aliases": []},
    {"en": "Dhemsa Gravy",                "mr": "ढेमसे ग्रेव्ही",        "vegetable": "Dhemsa", "aliases": []},
    {"en": "Dhemsa Dry",                  "mr": "सुके ढेमसे",            "vegetable": "Dhemsa", "aliases": []},
    # ---- MIXED / LEGUMES ----
    {"en": "Overnight Soaked Veggies",    "mr": "रात्रभर भिजवलेल्या भाज्या",  "vegetable": "Mixed", "aliases": []},
    {"en": "Rajma",                       "mr": "राजमा",                "vegetable": "Mixed", "aliases": ["Kidney Beans"]},
    {"en": "Chane",                       "mr": "चणे",                  "vegetable": "Mixed", "aliases": ["Chickpeas"]},
    {"en": "Chole",                       "mr": "छोले",                 "vegetable": "Mixed", "aliases": []},
    {"en": "Small Barbati",               "mr": "छोटी बरबटी",            "vegetable": "Mixed", "aliases": []},
    {"en": "Big Barbati",                 "mr": "मोठी बरबटी",            "vegetable": "Mixed", "aliases": []},
    {"en": "Masoor",                      "mr": "मसूर",                 "vegetable": "Mixed", "aliases": []},
    {"en": "Mathki",                      "mr": "मटकी",                 "vegetable": "Mixed", "aliases": ["Matki", "Moth Beans"]},
    {"en": "Purana Urad Dal Tomato",      "mr": "पुराण उडीद डाळ टोमॅटो", "vegetable": "Mixed", "aliases": []},
    {"en": "Purana Moong Dal Tamarind Jaggery", "mr": "पुराण मूग डाळ चिंच गुळ", "vegetable": "Mixed", "aliases": []},
    {"en": "Veg Anda Curry",              "mr": "व्हेज अंडा करी",        "vegetable": "Mixed", "aliases": []},
    {"en": "Kofta",                       "mr": "कोफ्ता",                "vegetable": "Mixed", "aliases": []},
]

KADHI_SAAR = [
    {"en": "Besan Kadhi",                 "mr": "बेसन कढी",             "aliases": []},
    {"en": "Tomato Kadhi or Saar",        "mr": "टोमॅटो कढी / सार",      "aliases": []},
    {"en": "Kaccha Mango Kadhi or Saar",  "mr": "कैरी कढी / सार",        "aliases": ["Kairi Kadhi"]},
    {"en": "Chincha Kadhi or Saar",       "mr": "चिंच कढी / सार",        "aliases": ["Tamarind Kadhi"]},
]

GRAVIES = [
    {"en": "Universal Red Gravy",         "mr": "लाल ग्रेव्ही",          "aliases": ["Red Gravy"]},
    {"en": "White Gravy",                 "mr": "पांढरी ग्रेव्ही",        "aliases": []},
    {"en": "Red Sweet Gravy",             "mr": "लाल गोड ग्रेव्ही",       "aliases": []},
    {"en": "Green Gravy",                 "mr": "हिरवी ग्रेव्ही",        "aliases": []},
    {"en": "Ranveer's Gravy",             "mr": "रणवीरची ग्रेव्ही",      "aliases": []},
]

# ----------------------------------------------------------------------------- #
# Composed-meal sections — for "show me a full thali idea" inspiration.          #
# Each entry has a title + an ordered list of component slots.                   #
# These seed the meal-planner's auto-suggest pairings in Phase 2.                #
# ----------------------------------------------------------------------------- #

PARTY_TIME = [
    {
        "title": "Paneer Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Paneer Gravy Bhaji"},
            {"slot": "sabji_dry",   "name": "Aloo Capsicum Dry Bhaji"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "sweet",       "name": "Shrikhand"},
            {"slot": "snack",       "name": "Makka Vade"},
            {"slot": "koshimbhir",  "name": "Any Koshimbhir"},
        ],
    },
    {
        "title": "Jackfruit Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Jackfruit Gravy Bhaji"},
            {"slot": "sabji_dry",   "name": "Bhindi"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "sweet",       "name": "Khir"},
            {"slot": "snack",       "name": "Papad"},
            {"slot": "koshimbhir",  "name": "Onion Koshimbhir"},
        ],
    },
    {
        "title": "Patavadi Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Patavadi"},
            {"slot": "sabji_dry",   "name": "Cabbage"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "sweet",       "name": "Gulab Jamun"},
            {"slot": "snack",       "name": "Bhaje"},
            {"slot": "koshimbhir",  "name": "Onion Koshimbhir"},
        ],
    },
    {
        "title": "Bharlele Dhemse Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Bharlele Dhemse"},
            {"slot": "sabji_dry",   "name": "Beans / Shenga"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "sweet",       "name": "Rasgulla"},
            {"slot": "snack",       "name": "Dhokla"},
            {"slot": "koshimbhir",  "name": "Chana Dalimb"},
        ],
    },
    {
        "title": "Bharlele Vange Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Bharlele Vange"},
            {"slot": "sabji_dry",   "name": "Beans / Shenga"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "sweet",       "name": "Ras Malai"},
            {"slot": "koshimbhir",  "name": "Any Koshimbhir"},
        ],
    },
    {
        "title": "Veg Anda Thali",
        "components": [
            {"slot": "sabji_gravy", "name": "Veg Anda Curry"},
            {"slot": "rice",        "name": "Jeera Rice"},
            {"slot": "dal",         "name": "Dal Fry"},
            {"slot": "koshimbhir",  "name": "Onion Koshimbhir"},
        ],
    },
]

# Traditional Maharashtrian combinations from sheet 12 — each cell was a
# comma-separated component list. Parsed into the same shape as PARTY_TIME.
COMBINATIONS = [
    {
        "title": "Pandhari Poli Combination",
        "components": [
            {"slot": "roti",     "name": "Pandhari Poli"},
            {"slot": "dal",      "name": "Ghatta Besan"},
            {"slot": "chatni",   "name": "Thecha"},
            {"slot": "drink",    "name": "Buttermilk"},
        ],
    },
    {
        "title": "Bhakar with Ghatta Varan",
        "components": [
            {"slot": "roti",       "name": "Bhakari"},
            {"slot": "dal",        "name": "Ghatta Varan"},
            {"slot": "koshimbhir", "name": "Dahi"},
            {"slot": "side",       "name": "Onion"},
        ],
    },
    {
        "title": "Bhakar with Bharit and Urad Dal",
        "components": [
            {"slot": "roti",     "name": "Bhakari"},
            {"slot": "sabji",    "name": "Bharit / Vange Bhaji / Besan"},
            {"slot": "dal",      "name": "Urad Dal Varan"},
            {"slot": "side",     "name": "Onion"},
            {"slot": "chatni",   "name": "Thecha"},
            {"slot": "drink",    "name": "Buttermilk"},
        ],
    },
    {
        "title": "Bajri Bhakri with Jaggery and Ghee",
        "components": [
            {"slot": "roti",     "name": "Bajari Roti"},
            {"slot": "side",     "name": "Jaggery + Ghee"},
            {"slot": "chatni",   "name": "Thecha"},
            {"slot": "drink",    "name": "Buttermilk"},
        ],
    },
    {
        "title": "Bhakar with Chana Dal Tamarind Jaggery Bhaji",
        "components": [
            {"slot": "roti",     "name": "Bhakari"},
            {"slot": "sabji",    "name": "Chana Dal Tamarind Jaggery Dal Bhaji"},
            {"slot": "chatni",   "name": "Thecha"},
            {"slot": "drink",    "name": "Buttermilk"},
        ],
    },
    {
        "title": "Bhakar with Fenugreek Moong Dal Bhaji",
        "components": [
            {"slot": "roti",     "name": "Bhakari"},
            {"slot": "sabji",    "name": "Fenugreek Moong Dal Bhaji"},
        ],
    },
]

# ----------------------------------------------------------------------------- #
# Public registry — convenient single import for the API route                  #
# ----------------------------------------------------------------------------- #

EVERYDAY_MENU = {
    "Chapati":    CHAPATI,
    "Dal":        DAL,
    "Sabji":      SABJI,
    "Rice":       RICE,
    "Koshimbhir": KOSHIMBHIR,
    "Chatni":     CHATNI,
    "KadhiSaar":  KADHI_SAAR,
    "Gole":       GOLE,
    "Gravies":    GRAVIES,
}

COMPOSED_MEALS = {
    "PartyTime":    PARTY_TIME,
    "Combinations": COMBINATIONS,
}


def menu_summary():
    """Quick diagnostic for the importer."""
    return {
        "categories": {cat: len(items) for cat, items in EVERYDAY_MENU.items()},
        "composed":   {cat: len(items) for cat, items in COMPOSED_MEALS.items()},
        "total_dishes": sum(len(items) for items in EVERYDAY_MENU.values()),
        "total_composed": sum(len(items) for items in COMPOSED_MEALS.values()),
    }
