/**
 * IngredientAvatar — the visual anchor for an inventory item.
 *
 * Inventory rows were text-only, so every item looked identical at a glance
 * and you had to *read* the list instead of scanning it. This renders a
 * tinted tile with a glyph resolved through a deliberate fallback chain:
 *
 *   1. keyword match on the item name/aliases  → specific ingredient emoji
 *   2. the item's category emoji (CATEGORIES)   → always present
 *   3. first letter monogram                    → only if category is junk
 *
 * The chain matters more than the map's completeness: receipt-scanned custom
 * items and any newly added catalog entry fall through to the category emoji
 * and still look intentional. That's also the seam where a real SVG sprite
 * would slot in later as step 0 — no call-site changes needed.
 *
 * Order is significant. Earlier keys win, so put specific terms before the
 * generic ones they contain ('mustard oil' before 'oil', 'coconut' before
 * 'nut') or the generic match will swallow them.
 *
 * Matching is WHOLE-WORD, not substring. A plain `includes()` produces
 * nonsense collisions on short keys — 'tur' fires inside "Turmeric", 'hing'
 * inside "Thing", 'til' inside "Lentil" — so keys are compiled to
 * word-boundary regexes instead. A trailing "s" is tolerated so "Dates" and
 * "Almonds" still match 'date' and 'almond'.
 */

const INGREDIENT_EMOJI = [
  // --- oils & ghee (before the bare 'oil'/'ghee' catch-alls) ---
  ['mustard oil', '🛢️'], ['coconut oil', '🥥'], ['olive oil', '🫒'],
  ['groundnut oil', '🥜'], ['peanut oil', '🥜'], ['sesame oil', '🛢️'],
  ['ghee', '🧈'], ['butter', '🧈'], ['oil', '🧴'],

  // --- grains & flours ---
  ['basmati', '🍚'], ['rice', '🍚'], ['poha', '🍚'], ['rava', '🌾'],
  ['suji', '🌾'], ['semolina', '🌾'], ['atta', '🌾'], ['maida', '🌾'],
  ['besan', '🌾'], ['flour', '🌾'], ['wheat', '🌾'], ['bajra', '🌾'],
  ['jowar', '🌾'], ['ragi', '🌾'], ['oats', '🥣'], ['quinoa', '🌾'],
  ['sabudana', '⚪'], ['vermicelli', '🍜'], ['pasta', '🍝'], ['noodle', '🍜'],
  ['bread', '🍞'], ['pav', '🍞'], ['bun', '🍞'], ['biscuit', '🍪'],
  ['rusk', '🍞'], ['toast', '🍞'],

  // --- pulses ---
  ['rajma', '🫘'], ['chana', '🫘'], ['chole', '🫘'], ['chickpea', '🫘'],
  ['moong', '🫘'], ['masoor', '🫘'], ['toor', '🫘'], ['tur', '🫘'],
  ['arhar', '🫘'], ['urad', '🫘'], ['matki', '🫘'], ['moth', '🫘'],
  ['lobia', '🫘'], ['dal', '🫘'], ['daal', '🫘'], ['pulse', '🫘'],
  ['lentil', '🫘'], ['bean', '🫘'], ['soya', '🫘'], ['peas', '🫛'],

  // --- spices & masalas ---
  ['haldi', '🟡'], ['turmeric', '🟡'], ['mirchi', '🌶️'], ['chilli', '🌶️'],
  ['chili', '🌶️'], ['pepper', '🌶️'], ['dhania', '🌿'], ['coriander', '🌿'],
  ['jeera', '🟤'], ['cumin', '🟤'], ['mohari', '🟤'], ['mustard', '🟤'],
  ['methi', '🌿'], ['fenugreek', '🌿'], ['hing', '🟤'], ['asafoetida', '🟤'],
  ['elaichi', '🫛'], ['cardamom', '🫛'], ['laung', '🟤'], ['clove', '🟤'],
  ['dalchini', '🪵'], ['cinnamon', '🪵'], ['tej patta', '🍃'], ['bay leaf', '🍃'],
  ['kadi patta', '🍃'], ['curry leaf', '🍃'], ['garam masala', '🥫'],
  ['masala', '🥫'], ['salt', '🧂'], ['namak', '🧂'], ['spice', '🌶️'],

  // --- vegetables ---
  ['aloo', '🥔'], ['potato', '🥔'], ['batata', '🥔'], ['kanda', '🧅'],
  ['onion', '🧅'], ['pyaz', '🧅'], ['tomato', '🍅'], ['tamatar', '🍅'],
  ['lehsun', '🧄'], ['garlic', '🧄'], ['adrak', '🫚'], ['ginger', '🫚'],
  ['gajar', '🥕'], ['carrot', '🥕'], ['bhindi', '🌱'], ['okra', '🌱'],
  ['baingan', '🍆'], ['brinjal', '🍆'], ['eggplant', '🍆'],
  ['palak', '🥬'], ['spinach', '🥬'], ['methi bhaji', '🥬'], ['cabbage', '🥬'],
  ['patta gobi', '🥬'], ['cauliflower', '🥦'], ['gobi', '🥦'],
  ['broccoli', '🥦'], ['capsicum', '🫑'], ['simla', '🫑'], ['shimla', '🫑'],
  ['cucumber', '🥒'], ['kakdi', '🥒'], ['lauki', '🥒'], ['dudhi', '🥒'],
  ['pumpkin', '🎃'], ['kaddu', '🎃'], ['bhopla', '🎃'], ['corn', '🌽'],
  ['makai', '🌽'], ['mushroom', '🍄'], ['beetroot', '🫐'], ['radish', '🥬'],
  ['mooli', '🥬'], ['drumstick', '🌱'], ['shevga', '🌱'],

  // --- fruits ---
  ['kela', '🍌'], ['banana', '🍌'], ['seb', '🍎'], ['apple', '🍎'],
  ['aam', '🥭'], ['mango', '🥭'], ['santra', '🍊'], ['orange', '🍊'],
  ['mosambi', '🍊'], ['angur', '🍇'], ['grape', '🍇'], ['papaya', '🥭'],
  ['papai', '🥭'], ['anar', '🍎'], ['pomegranate', '🍎'],
  ['watermelon', '🍉'], ['kalingad', '🍉'], ['tarbuj', '🍉'],
  ['chikoo', '🥝'], ['kiwi', '🥝'], ['pear', '🍐'], ['guava', '🍐'],
  ['peru', '🍐'], ['strawberry', '🍓'], ['pineapple', '🍍'],
  ['ananas', '🍍'], ['lemon', '🍋'], ['nimbu', '🍋'], ['limbu', '🍋'],
  ['coconut', '🥥'], ['nariyal', '🥥'], ['khobra', '🥥'],

  // --- dairy & eggs ---
  ['milk', '🥛'], ['doodh', '🥛'], ['dahi', '🥛'], ['curd', '🥛'],
  ['yogurt', '🥛'], ['yoghurt', '🥛'], ['paneer', '🧀'], ['cheese', '🧀'],
  ['cream', '🥛'], ['malai', '🥛'], ['buttermilk', '🥛'], ['chaas', '🥛'],
  ['lassi', '🥛'], ['khoya', '🥛'], ['egg', '🥚'], ['anda', '🥚'],

  // --- sweeteners ---
  ['sugar', '🍬'], ['shakkar', '🍬'], ['cheeni', '🍬'], ['gur', '🟫'],
  ['jaggery', '🟫'], ['gud', '🟫'], ['honey', '🍯'], ['shahad', '🍯'],
  ['madh', '🍯'],

  // --- dry fruits & nuts ---
  ['badam', '🌰'], ['almond', '🌰'], ['kaju', '🌰'], ['cashew', '🌰'],
  ['pista', '🌰'], ['pistachio', '🌰'], ['walnut', '🌰'], ['akhrot', '🌰'],
  ['kishmish', '🍇'], ['raisin', '🍇'], ['khajur', '🌴'], ['date', '🌴'],
  ['anjeer', '🟤'], ['fig', '🟤'], ['peanut', '🥜'], ['groundnut', '🥜'],
  ['shengdana', '🥜'], ['til', '⚪'], ['sesame', '⚪'], ['nut', '🌰'],

  // --- beverages ---
  ['chai', '🍵'], ['tea', '🍵'], ['coffee', '☕'], ['horlicks', '🥛'],
  ['bournvita', '🥛'], ['juice', '🧃'], ['squash', '🧃'], ['water', '💧'],

  // --- condiments & ready mix ---
  ['pickle', '🥫'], ['achar', '🥫'], ['loncha', '🥫'], ['papad', '🫓'],
  ['chutney', '🥫'], ['sauce', '🥫'], ['ketchup', '🍅'], ['jam', '🍓'],
  ['vinegar', '🧴'], ['tamarind', '🟤'], ['chinch', '🟤'], ['imli', '🟤'],
  ['idli', '🍚'], ['dosa', '🥞'], ['upma', '🥣'], ['poori', '🫓'],
  ['namkeen', '🍿'], ['chivda', '🍿'], ['chips', '🍟'], ['chocolate', '🍫'],

  // --- household & cleaning ---
  ['soap', '🧼'], ['sabun', '🧼'], ['detergent', '🧼'], ['surf', '🧼'],
  ['shampoo', '🧴'], ['toothpaste', '🪥'], ['brush', '🪥'],
  ['phenyl', '🧽'], ['harpic', '🧽'], ['cleaner', '🧽'], ['broom', '🧹'],
  ['jhadu', '🧹'], ['tissue', '🧻'], ['toilet', '🧻'], ['garbage', '🗑️'],
  ['agarbatti', '🪔'], ['incense', '🪔'], ['candle', '🕯️'],
  ['matchbox', '🔥'], ['gas', '🔥'], ['foil', '📄'], ['bag', '🛍️'],

  // --- medicine ---
  ['tablet', '💊'], ['syrup', '🧴'], ['balm', '🧴'], ['bandage', '🩹'],
  ['sanitizer', '🧴'], ['mask', '😷'],
];

// Compiled once at module load — one regex per key, anchored to word
// boundaries. Keys are plain words here, but the escape keeps a future key
// containing regex punctuation from blowing up.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = INGREDIENT_EMOJI.map(([key, emoji]) => [
  new RegExp(`\\b${escapeRe(key)}s?\\b`),
  emoji,
]);

/**
 * Resolve the glyph for an item. Matching is done on the lowercased English
 * name plus any aliases, so "Tur Dal" and its alias "Toor Dal" both land on
 * the pulses glyph.
 */
export const resolveIngredientGlyph = (item, categoryInfo) => {
  const haystack = [item?.name_en, ...(item?.aliases || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack) {
    for (const [re, emoji] of COMPILED) {
      if (re.test(haystack)) return { glyph: emoji, kind: 'ingredient' };
    }
  }

  if (categoryInfo?.emoji) return { glyph: categoryInfo.emoji, kind: 'category' };

  const initial = (item?.name_en || '?').trim().charAt(0).toUpperCase();
  return { glyph: initial || '?', kind: 'monogram' };
};

const SIZES = {
  sm: { box: 'w-9 h-9 rounded-[10px]', glyph: 'text-lg', mono: 'text-sm' },
  md: { box: 'w-12 h-12 rounded-xl', glyph: 'text-2xl', mono: 'text-lg' },
};

export const IngredientAvatar = ({
  item,
  categoryInfo,
  size = 'sm',
  className = '',
}) => {
  const { glyph, kind } = resolveIngredientGlyph(item, categoryInfo);
  const dims = SIZES[size] || SIZES.sm;
  const tint = categoryInfo?.tile || 'bg-gray-100';

  return (
    <div
      className={`${dims.box} ${tint} flex-shrink-0 flex items-center justify-center border border-black/5 ${className}`}
      // The glyph is decorative — the item name sits right next to it in text,
      // so announcing the emoji would just be noise for screen readers.
      aria-hidden="true"
      data-testid={`ingredient-avatar-${item?.id}`}
      data-glyph-kind={kind}
    >
      <span className={kind === 'monogram' ? `${dims.mono} font-bold text-gray-500` : `${dims.glyph} leading-none`}>
        {glyph}
      </span>
    </div>
  );
};

export default IngredientAvatar;
