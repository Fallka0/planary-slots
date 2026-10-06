import type { Pip as PipId } from "../../shared/slots";

/*
  The symbols, screen-printed.

  Each one is a flat shape in the cabinet's ink on the cabinet's paper, plus at
  most one second ink. No bevels, no highlights, no gloss: a slot symbol is a
  decal on a drum, and the whole press this casino is printed on refuses
  anything that looks rendered. Drawn on a 100 × 100 field so a reel can scale
  them with one number.

  The planetary set reads from the same press: a crescent is two circles, a
  ringed planet is a disc and an ellipse, and the sun's rays are triangles cut
  from one plate. The specials carry a second ink — the house red — so a wild,
  a portal, a wheel or a coin is told apart from a paying symbol at a glance,
  even mid-spin.
*/

const CHERRY = (
  <>
    <path d="M44 16C58 32 52 50 40 64M44 16C62 24 76 44 80 62" fill="none" strokeWidth="6" strokeLinecap="round" />
    <circle cx="34" cy="76" r="18" />
    <circle cx="76" cy="74" r="16" />
  </>
);

const BELL = (
  <>
    <path d="M50 14c-16 0-26 11-26 28 0 18-5 26-10 32h72c-5-6-10-14-10-32 0-17-10-28-26-28z" />
    <circle cx="50" cy="12" r="7" />
    <path d="M38 80a12 12 0 0 0 24 0z" />
  </>
);

const STAR = <path d="M50 10 61 38 92 40 68 59 76 90 50 73 24 90 32 59 8 40 39 38z" />;

/** The house red, the second ink on every special. */
const HOUSE = "#d9173c";

/** Points round a centre, alternating two radii: a burst, a star or the sun's rays. */
function burst(points: number, outer: number, inner: number, cx = 50, cy = 50, turn = 0) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2 + turn;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** One ink and one shape each; the two-tone ones name their second ink. */
export function Pip({ pip, size = 64, ink = "currentColor", paper = "var(--paper)" }: { pip: PipId; size?: number; ink?: string; paper?: string }) {
  if (pip === "blank") return <span className="pip is-blank" style={{ width: size, height: size }} aria-hidden="true" />;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`pip is-${pip}`} aria-hidden="true" focusable="false">
      {pip === "cherry" ? (
        <g fill={ink} stroke={ink}>
          {CHERRY}
        </g>
      ) : null}

      {pip === "bar" ? (
        <>
          <rect x="6" y="32" width="88" height="36" rx="8" fill={ink} />
          <text x="50" y="59" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily="var(--font-poster)" letterSpacing="1.5" fill={paper}>
            BAR
          </text>
        </>
      ) : null}

      {pip === "bell" ? <g fill={ink}>{BELL}</g> : null}

      {pip === "star" ? <g fill={ink}>{STAR}</g> : null}

      {pip === "seven" ? (
        <text x="52" y="86" textAnchor="middle" fontSize="108" fontWeight="900" fontFamily="var(--font-poster)" fill={ink}>
          7
        </text>
      ) : null}

      {/* The version-1 scatter is the house chip itself. */}
      {pip === "chip" ? (
        <>
          <circle cx="50" cy="50" r="42" fill={ink} />
          <circle cx="50" cy="50" r="33" fill="none" stroke={paper} strokeWidth="9" strokeDasharray="13 13" />
          <circle cx="50" cy="50" r="22" fill={paper} />
          <text x="50" y="64" textAnchor="middle" fontSize="34" fontWeight="900" fontFamily="var(--font-poster)" fill={ink}>
            P
          </text>
        </>
      ) : null}

      {/* ── The planetary set ── */}

      {/* A crescent: one disc, with a second in the paper cut out of it. */}
      {pip === "moon" ? (
        <>
          <circle cx="50" cy="52" r="36" fill={ink} />
          <circle cx="66" cy="40" r="30" fill={paper} />
          <circle cx="30" cy="62" r="4.5" fill={paper} />
          <circle cx="40" cy="78" r="3" fill={paper} />
        </>
      ) : null}

      {/* A head and three streaks of tail. */}
      {pip === "comet" ? (
        <>
          <path d="M58 44 14 18M60 54 10 44M54 62 20 74" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round" />
          <circle cx="66" cy="50" r="22" fill={ink} />
          <circle cx="60" cy="44" r="6" fill={paper} />
        </>
      ) : null}

      {pip === "rocket" ? (
        <g transform="rotate(35 50 50)">
          <path d="M50 6c13 12 18 30 18 50H32C32 36 37 18 50 6z" fill={ink} />
          <path d="M32 56 18 72l14-2zM68 56l14 16-14-2z" fill={ink} />
          <circle cx="50" cy="36" r="8" fill={paper} />
          <path d="M40 62h20l-4 16h-12z" fill={ink} />
          <path d="M44 82h12l-6 14z" fill={ink} opacity="0.55" />
        </g>
      ) : null}

      {/* The ring passes behind the disc at the top and in front at the bottom. */}
      {pip === "ring" ? (
        <>
          <path d="M8 56c0-9 19-16 42-16s42 7 42 16" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
          <circle cx="50" cy="50" r="27" fill={ink} />
          <path d="M28 44h44M25 54h50" stroke={paper} strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
          <path d="M8 56c0 9 19 16 42 16s42-7 42-16" fill="none" stroke={paper} strokeWidth="13" strokeLinecap="round" />
          <path d="M8 56c0 9 19 16 42 16s42-7 42-16" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
        </>
      ) : null}

      {/* The top symbol: a sixteen-point burst. */}
      {pip === "nova" ? (
        <>
          <polygon points={burst(8, 48, 30)} fill={ink} />
          <polygon points={burst(8, 30, 16, 50, 50, Math.PI / 8)} fill={paper} />
          <circle cx="50" cy="50" r="10" fill={ink} />
        </>
      ) : null}

      {/* WILD: the sun, rays in the house red. */}
      {pip === "sun" ? (
        <>
          <polygon points={burst(12, 49, 34)} fill={HOUSE} />
          <circle cx="50" cy="50" r="32" fill={ink} />
          <text x="50" y="60" textAnchor="middle" fontSize="27" fontWeight="900" fontFamily="var(--font-poster)" fill={paper} letterSpacing="0.5">
            WILD
          </text>
        </>
      ) : null}

      {/* SCATTER: a portal, a spiral printed in two plates. */}
      {pip === "portal" ? (
        <>
          <circle cx="50" cy="50" r="45" fill={HOUSE} />
          <path d="M50 50m-6 0a6 6 0 1 1 12 0a14 14 0 1 1-28 0a22 22 0 1 1 44 0a30 30 0 1 1-60 0" fill="none" stroke={paper} strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="5" fill={paper} />
        </>
      ) : null}

      {/* BONUS: the Orbit Wheel itself, in miniature. */}
      {pip === "wheel" ? (
        <>
          <circle cx="50" cy="50" r="45" fill={HOUSE} />
          <circle cx="50" cy="50" r="35" fill={paper} />
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={i}
              d={`M50 50L${50 + 35 * Math.cos((i * Math.PI) / 4)} ${50 + 35 * Math.sin((i * Math.PI) / 4)}`}
              stroke={ink}
              strokeWidth={i % 2 ? 3 : 6}
            />
          ))}
          <circle cx="50" cy="50" r="12" fill={ink} />
          <path d="M50 2 58 16H42z" fill={ink} />
        </>
      ) : null}

      {/* HOLD & WIN: a moon coin, the house chip's ring round a crescent. */}
      {pip === "coin" ? (
        <>
          <circle cx="50" cy="50" r="44" fill={HOUSE} />
          <circle cx="50" cy="50" r="35" fill="none" stroke={paper} strokeWidth="8" strokeDasharray="11 11" />
          <circle cx="50" cy="50" r="24" fill={paper} />
          <circle cx="50" cy="51" r="16" fill={HOUSE} />
          <circle cx="57" cy="45" r="13" fill={paper} />
        </>
      ) : null}
    </svg>
  );
}

/** What a symbol is called in running copy. */
export const PIP_NAMES: Record<PipId, string> = {
  blank: "Blank",
  cherry: "Cherry",
  bar: "Bar",
  bell: "Bell",
  star: "Star",
  seven: "Seven",
  chip: "Chip",
  moon: "Moon",
  comet: "Comet",
  rocket: "Rocket",
  ring: "Ringed planet",
  nova: "Nova",
  sun: "Sun (wild)",
  portal: "Portal",
  wheel: "Orbit Wheel",
  coin: "Moon coin",
};

/** The specials, which carry the house red. */
export const SPECIAL: ReadonlySet<PipId> = new Set(["sun", "portal", "wheel", "coin", "chip"]);
