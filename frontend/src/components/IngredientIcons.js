/**
 * IngredientIcons — hand-drawn SVG glyphs for staples the emoji set can't
 * tell apart.
 *
 * Every dal shares 🫘, so six pulse rows in a category looked identical and
 * the user had to read each name. These icons encode the two things a cook
 * actually recognises a dal by — shape and colour: toor's yellow split
 * discs, moong's small green cylinders, chana's beaked brown seeds,
 * masoor's orange discs, urad's black grain with the white hilum stripe,
 * rajma's kidney shape.
 *
 * This is step 0 of IngredientAvatar's fallback chain: matched here → SVG;
 * otherwise the emoji map, category emoji, and monogram behave as before,
 * so unmapped items lose nothing. Extend by adding a draw function and its
 * keywords below — flat fills with a darker outline of the same hue, drawn
 * in a 36×36 viewBox, and keep the seed cluster inside ~3px margins so the
 * icon breathes inside the tinted tile.
 *
 * Matching mirrors IngredientAvatar's word-boundary rule (with the same
 * tolerated trailing "s") — a substring match would fire 'tur' inside
 * "Turmeric".
 */

const Svg = ({ px, children }) => (
  <svg width={px} height={px} viewBox="0 0 36 36" aria-hidden="true">
    {children}
  </svg>
);

const ToorIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#F2BE3B" stroke="#C08E12" strokeWidth="1.2">
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="24" cy="11" r="5.2" />
      <circle cx="9" cy="24" r="5.2" />
      <circle cx="20" cy="23" r="5.2" />
      <circle cx="29" cy="24" r="5.2" />
    </g>
    <g stroke="#C08E12" strokeWidth="1.1" strokeLinecap="round">
      <line x1="8.2" y1="12" x2="15.8" y2="12" />
      <line x1="20.2" y1="11" x2="27.8" y2="11" />
      <line x1="5.2" y1="24" x2="12.8" y2="24" />
      <line x1="16.2" y1="23" x2="23.8" y2="23" />
      <line x1="25.2" y1="24" x2="32.8" y2="24" />
    </g>
  </Svg>
);

const MoongIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#6FA83A" stroke="#47701F" strokeWidth="1.1">
      <rect x="6" y="9" width="10" height="6" rx="3" transform="rotate(-14 11 12)" />
      <rect x="20" y="8" width="10" height="6" rx="3" transform="rotate(10 25 11)" />
      <rect x="4" y="21" width="10" height="6" rx="3" transform="rotate(8 9 24)" />
      <rect x="15" y="20" width="10" height="6" rx="3" transform="rotate(-10 20 23)" />
      <rect x="24" y="23" width="10" height="6" rx="3" transform="rotate(14 29 26)" />
    </g>
    <g stroke="#EDF5E2" strokeWidth="1.4" strokeLinecap="round">
      <line x1="10" y1="11.4" x2="12.4" y2="11" />
      <line x1="24" y1="10.6" x2="26.4" y2="11" />
      <line x1="8" y1="23.6" x2="10.4" y2="24" />
      <line x1="19" y1="22.4" x2="21.4" y2="22" />
      <line x1="28" y1="25.6" x2="30.4" y2="26" />
    </g>
  </Svg>
);

const ChanaIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#C79155" stroke="#8F6128" strokeWidth="1.2">
      <circle cx="12" cy="14" r="6.5" />
      <circle cx="9" cy="9.5" r="2.6" />
      <circle cx="26" cy="13" r="6" />
      <circle cx="23.4" cy="8.8" r="2.4" />
      <circle cx="18" cy="26" r="6.5" />
      <circle cx="15" cy="21.5" r="2.6" />
    </g>
    <g stroke="#8F6128" strokeWidth="1" strokeLinecap="round" fill="none">
      <path d="M9.5 13.5q2.5-1.5 5 0" />
      <path d="M23.8 12.6q2.2-1.4 4.4 0" />
      <path d="M15.5 25.5q2.5-1.5 5 0" />
    </g>
  </Svg>
);

const MasoorIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#E8833A" stroke="#AD5312" strokeWidth="1.2">
      <circle cx="11" cy="11" r="5" />
      <circle cx="23" cy="10" r="5" />
      <circle cx="30" cy="19" r="4.6" />
      <circle cx="8" cy="23" r="5" />
      <circle cx="19" cy="22" r="5" />
      <circle cx="26" cy="29" r="4.2" />
    </g>
  </Svg>
);

const UradIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#3B3B3B" stroke="#1E1E1E" strokeWidth="1">
      <rect x="6" y="9" width="10" height="6.4" rx="3.2" transform="rotate(-12 11 12)" />
      <rect x="20" y="8" width="10" height="6.4" rx="3.2" transform="rotate(12 25 11)" />
      <rect x="5" y="21" width="10" height="6.4" rx="3.2" transform="rotate(6 10 24)" />
      <rect x="17" y="21" width="10" height="6.4" rx="3.2" transform="rotate(-8 22 24)" />
    </g>
    <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round">
      <line x1="10" y1="11.6" x2="12.6" y2="11.2" />
      <line x1="23.6" y1="10.8" x2="26.2" y2="11.2" />
      <line x1="9" y1="23.8" x2="11.6" y2="24" />
      <line x1="21" y1="23.6" x2="23.6" y2="23.4" />
    </g>
  </Svg>
);

const RajmaIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#8E2F35" stroke="#5E1B20" strokeWidth="1.1">
      <ellipse cx="12" cy="13" rx="7" ry="4.6" transform="rotate(-24 12 13)" />
      <ellipse cx="25" cy="15" rx="7" ry="4.6" transform="rotate(18 25 15)" />
      <ellipse cx="17" cy="26" rx="7" ry="4.6" transform="rotate(-8 17 26)" />
    </g>
    {/* Hilum spots in an off-white that reads on any tile tint — the real
        tile colour varies by category, so nothing here may assume it. */}
    <g fill="#F3E7D9">
      <circle cx="8.6" cy="16.6" r="1.7" />
      <circle cx="21.8" cy="12.4" r="1.7" />
      <circle cx="13.4" cy="24" r="1.7" />
    </g>
  </Svg>
);

// Order is significant, same as the emoji map: specific keys must come
// before generic ones they contain. Keywords cover the English names plus
// the Hindi/Marathi romanisations that show up in names and aliases.
const INGREDIENT_ICONS = [
  ['toor', ToorIcon], ['tur', ToorIcon], ['arhar', ToorIcon],
  ['moong', MoongIcon], ['mung', MoongIcon],
  ['chana', ChanaIcon], ['chole', ChanaIcon], ['chickpea', ChanaIcon],
  ['harbara', ChanaIcon], ['harbhara', ChanaIcon],
  ['masoor', MasoorIcon], ['masur', MasoorIcon],
  ['urad', UradIcon], ['udid', UradIcon],
  ['rajma', RajmaIcon], ['kidney bean', RajmaIcon],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = INGREDIENT_ICONS.map(([key, Icon]) => [
  new RegExp(`\\b${escapeRe(key)}s?\\b`),
  Icon,
]);

/**
 * Return the icon component for an item, or null when the emoji chain
 * should take over. Matches on the lowercased English name plus aliases,
 * mirroring resolveIngredientGlyph.
 */
export const resolveIngredientIcon = (item) => {
  const haystack = [item?.name_en, ...(item?.aliases || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!haystack) return null;

  for (const [re, Icon] of COMPILED) {
    if (re.test(haystack)) return Icon;
  }
  return null;
};
