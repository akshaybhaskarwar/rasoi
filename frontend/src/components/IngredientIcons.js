/**
 * IngredientIcons — hand-drawn SVG glyphs for staples the emoji set can't
 * tell apart.
 *
 * Every dal shares 🫘, most flours share 🌾, and jeera/mohari/hing share 🟤,
 * so whole runs of rows looked identical and the user had to read each
 * name. These icons encode the two things a cook actually recognises a
 * staple by — shape and colour: toor's yellow split discs, moong's small
 * green cylinders, chana's beaked brown seeds, masoor's orange discs,
 * urad's black grain with the white hilum stripe, rajma's kidney shape;
 * haldi's orange mound with the root, jeera's ridged crescents, mohari's
 * dark round seeds; and the flour mounds told apart by their garnish —
 * atta's wheat sprig, besan's chana seeds, rava's visible granules,
 * maida's plain pale peak.
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

const HaldiIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M5 28c1-8.5 7-13 13-13s12 4.5 13 13z" fill="#EBA92E" stroke="#B57B12" strokeWidth="1.2" />
    <g fill="#D98E26" stroke="#A5680F" strokeWidth="1.1">
      <rect x="17" y="4.5" width="13" height="5.4" rx="2.7" transform="rotate(22 23.5 7)" />
      <circle cx="28.5" cy="11" r="2.2" />
    </g>
    <g fill="#B57B12">
      <circle cx="9" cy="12" r="1.1" />
      <circle cx="13" cy="9" r="1.1" />
    </g>
  </Svg>
);

const JeeraIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#A9743C" stroke="#7A4E1F" strokeWidth="1">
      <ellipse cx="11" cy="10" rx="5.5" ry="2" transform="rotate(-24 11 10)" />
      <ellipse cx="25" cy="9" rx="5.5" ry="2" transform="rotate(18 25 9)" />
      <ellipse cx="8" cy="20" rx="5.5" ry="2" transform="rotate(12 8 20)" />
      <ellipse cx="21" cy="19" rx="5.5" ry="2" transform="rotate(-16 21 19)" />
      <ellipse cx="29" cy="26" rx="5.5" ry="2" transform="rotate(24 29 26)" />
      <ellipse cx="14" cy="28" rx="5.5" ry="2" transform="rotate(-8 14 28)" />
    </g>
    <g stroke="#E5C79A" strokeWidth="0.9" strokeLinecap="round">
      <line x1="7.5" y1="11.6" x2="14.5" y2="8.4" />
      <line x1="21.5" y1="8" x2="28.5" y2="10" />
      <line x1="4.5" y1="19.4" x2="11.5" y2="20.6" />
      <line x1="17.5" y1="20" x2="24.5" y2="18" />
      <line x1="25.5" y1="24.6" x2="32.5" y2="27.4" />
      <line x1="10.5" y1="28.4" x2="17.5" y2="27.6" />
    </g>
  </Svg>
);

const MustardIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#4A2E1A" stroke="#33200F" strokeWidth="0.9">
      <circle cx="10" cy="10" r="3.2" />
      <circle cx="20" cy="7.5" r="3.2" />
      <circle cx="29" cy="12" r="3.2" />
      <circle cx="7" cy="19" r="3.2" />
      <circle cx="16.5" cy="17" r="3.2" />
      <circle cx="26" cy="21" r="3.2" />
      <circle cx="12" cy="27" r="3.2" />
      <circle cx="21.5" cy="28" r="3.2" />
    </g>
    <g fill="#8B5A2B">
      <circle cx="9" cy="9" r="1" />
      <circle cx="15.5" cy="16" r="1" />
      <circle cx="25" cy="20" r="1" />
      <circle cx="11" cy="26" r="1" />
    </g>
  </Svg>
);

const AttaIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M4 29c1-8 7-12 14-12s13 4 14 12z" fill="#D9B98A" stroke="#A67F4E" strokeWidth="1.2" />
    <line x1="18" y1="16" x2="18" y2="7" stroke="#A67F4E" strokeWidth="1.3" strokeLinecap="round" />
    <g fill="#C29A54" stroke="#8F6A2E" strokeWidth="0.9">
      <ellipse cx="14.8" cy="10" rx="3" ry="1.7" transform="rotate(-38 14.8 10)" />
      <ellipse cx="21.2" cy="10" rx="3" ry="1.7" transform="rotate(38 21.2 10)" />
      <ellipse cx="15.4" cy="6" rx="3" ry="1.7" transform="rotate(-38 15.4 6)" />
      <ellipse cx="20.6" cy="6" rx="3" ry="1.7" transform="rotate(38 20.6 6)" />
    </g>
  </Svg>
);

const MaidaIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M4 29c1-7.5 6.5-11 14-11s13 3.5 14 11z" fill="#F5F1E8" stroke="#C9BFA8" strokeWidth="1.2" />
    <path d="M12 19c1-4.5 4-7 6-7s5 2.5 6 7" fill="#F5F1E8" stroke="#C9BFA8" strokeWidth="1.2" />
  </Svg>
);

const BesanIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M4 29c1-8 7-12 13-12s12 4 13 12z" fill="#EFC75E" stroke="#B8902A" strokeWidth="1.2" />
    <g fill="#C79155" stroke="#8F6128" strokeWidth="1">
      <circle cx="25" cy="9" r="4.4" />
      <circle cx="23" cy="5.8" r="1.9" />
      <circle cx="31" cy="14" r="3.6" />
      <circle cx="29.4" cy="11.3" r="1.6" />
    </g>
  </Svg>
);

const RavaIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M4 29c1-8 7-12 14-12s13 4 13 12z" fill="#EFE3C8" stroke="#B79F6E" strokeWidth="1.2" />
    <g fill="#C9A96B">
      <circle cx="11" cy="24" r="1.2" />
      <circle cx="16" cy="21" r="1.2" />
      <circle cx="21" cy="24.5" r="1.2" />
      <circle cx="26" cy="22" r="1.2" />
      <circle cx="14" cy="27" r="1.2" />
      <circle cx="24" cy="27.5" r="1.2" />
      <circle cx="19" cy="18.5" r="1.2" />
      <circle cx="29" cy="26" r="1.2" />
    </g>
  </Svg>
);

const OilIcon = ({ px }) => (
  <Svg px={px}>
    <rect x="14.5" y="3" width="7" height="3.6" rx="1.2" fill="#8F6128" />
    <rect x="15.5" y="6.6" width="5" height="4.4" fill="#FBF3D8" stroke="#B8860B" strokeWidth="1.1" />
    <rect x="10.5" y="10.5" width="15" height="22" rx="4.5" fill="#FBF3D8" stroke="#B8860B" strokeWidth="1.2" />
    <rect x="12.5" y="16" width="11" height="14.5" rx="3.2" fill="#F2C14E" />
    <line x1="15" y1="18.5" x2="15" y2="27.5" stroke="#FBF3D8" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const DhaniaSeed = ({ cx, cy }) => (
  <g transform={`translate(${cx} ${cy})`}>
    <circle r="3.6" fill="#C4A75B" stroke="#8A6F33" strokeWidth="1" />
    <path d="M-1.4-3q-1.6 3 0 6M1.4-3q1.6 3 0 6" fill="none" stroke="#8A6F33" strokeWidth="0.8" />
  </g>
);

const DhaniaIcon = ({ px }) => (
  <Svg px={px}>
    <DhaniaSeed cx={11} cy={10} />
    <DhaniaSeed cx={24} cy={9} />
    <DhaniaSeed cx={8} cy={22} />
    <DhaniaSeed cx={19} cy={19} />
    <DhaniaSeed cx={28} cy={22} />
    <DhaniaSeed cx={15} cy={29} />
  </Svg>
);

const DhaniaPowderIcon = ({ px }) => (
  <Svg px={px}>
    <path d="M4 29c1-8 7-12 13-12s12 4 13 12z" fill="#C9A653" stroke="#97742E" strokeWidth="1.2" />
    <DhaniaSeed cx={24} cy={9} />
    <DhaniaSeed cx={30} cy={14} />
  </Svg>
);

const ElaichiIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#9DBE72" stroke="#5F7F3B" strokeWidth="1.1">
      <ellipse cx="12" cy="10" rx="7.5" ry="3.6" transform="rotate(-20 12 10)" />
      <ellipse cx="25" cy="16" rx="7.5" ry="3.6" transform="rotate(16 25 16)" />
      <ellipse cx="14" cy="26" rx="7.5" ry="3.6" transform="rotate(-6 14 26)" />
    </g>
    <g stroke="#5F7F3B" strokeWidth="0.9" strokeLinecap="round" fill="none">
      <line x1="5.5" y1="12.4" x2="18.5" y2="7.6" />
      <line x1="18" y1="14" x2="32" y2="18" />
      <line x1="7" y1="26.7" x2="21" y2="25.3" />
    </g>
  </Svg>
);

const VaraiIcon = ({ px }) => (
  <Svg px={px}>
    <g fill="#EADFC2" stroke="#B7A87E" strokeWidth="0.9">
      <circle cx="10" cy="9" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="26" cy="10" r="2.4" />
      <circle cx="7" cy="17" r="2.4" />
      <circle cx="14.5" cy="15" r="2.4" />
      <circle cx="22" cy="17" r="2.4" />
      <circle cx="29.5" cy="18" r="2.4" />
      <circle cx="11" cy="24" r="2.4" />
      <circle cx="18.5" cy="23" r="2.4" />
      <circle cx="26" cy="26" r="2.4" />
      <circle cx="15" cy="30" r="2.4" />
      <circle cx="22" cy="30.5" r="2.4" />
    </g>
    <g fill="#CBBC93">
      <circle cx="9.4" cy="8.4" r="0.8" />
      <circle cx="21.4" cy="16.4" r="0.8" />
      <circle cx="14.4" cy="29.4" r="0.8" />
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
// before generic ones they contain. A null icon is an exclusion — it stops
// the scan and hands the item back to the emoji chain, so 'mustard oil'
// keeps its oil emoji instead of getting mustard seeds. Keywords cover the
// English names plus the Hindi/Marathi romanisations that show up in names
// and aliases.
const INGREDIENT_ICONS = [
  // pulses
  ['toor', ToorIcon], ['tur', ToorIcon], ['arhar', ToorIcon],
  ['moong', MoongIcon], ['mung', MoongIcon],
  ['chana', ChanaIcon], ['chole', ChanaIcon], ['chickpea', ChanaIcon],
  ['harbara', ChanaIcon], ['harbhara', ChanaIcon],
  ['masoor', MasoorIcon], ['masur', MasoorIcon],
  ['urad', UradIcon], ['udid', UradIcon],
  ['rajma', RajmaIcon], ['kidney bean', RajmaIcon],

  // spices — the 🟡/🟤 crowd
  ['haldi', HaldiIcon], ['turmeric', HaldiIcon],
  ['jeera', JeeraIcon], ['cumin', JeeraIcon],
  ['mustard oil', null],
  ['mohari', MustardIcon], ['mustard', MustardIcon],
  // powder before seeds; fresh leaves (kothimbir) stay with the 🌿 emoji
  ['coriander leaves', null], ['coriander leaf', null], ['kothimbir', null],
  ['coriander powder', DhaniaPowderIcon], ['dhania powder', DhaniaPowderIcon],
  ['coriander', DhaniaIcon], ['dhania', DhaniaIcon],
  // the icon is the green pod — black cardamom falls through
  ['black cardamom', null], ['badi elaichi', null],
  ['elaichi', ElaichiIcon], ['cardamom', ElaichiIcon],
  ['velchi', ElaichiIcon], ['veldoda', ElaichiIcon],

  // oils — only the generic bottle; named oils (coconut, olive, groundnut)
  // keep their specific emoji
  ['cooking oil', OilIcon], ['refined oil', OilIcon], ['sunflower oil', OilIcon],

  // fasting grains
  ['varai', VaraiIcon], ['vari', VaraiIcon], ['bhagar', VaraiIcon],
  ['barnyard millet', VaraiIcon],

  // flours — everything was 🌾
  ['atta', AttaIcon], ['wheat flour', AttaIcon],
  ['maida', MaidaIcon],
  ['besan', BesanIcon], ['gram flour', BesanIcon],
  ['rava', RavaIcon], ['suji', RavaIcon], ['sooji', RavaIcon],
  ['semolina', RavaIcon],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = INGREDIENT_ICONS.map(([key, Icon]) => [
  new RegExp(`\\b${escapeRe(key)}s?\\b`),
  Icon,
]);

/**
 * Return the icon component for an item, or null when the emoji chain
 * should take over. Matches on the lowercased English name plus aliases,
 * mirroring resolveIngredientGlyph. The first hit wins even when its icon
 * is null — that's how the exclusion entries work.
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
