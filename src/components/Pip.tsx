import type { Pip as PipId } from "../../shared/slots";

/*
  The symbols, screen-printed.

  Each one is a flat shape in the cabinet's ink on the cabinet's paper, plus at
  most one second ink. No bevels, no highlights, no gloss: a slot symbol is a
  decal on a drum, and the whole press this casino is printed on refuses
  anything that looks rendered. Drawn on a 100 × 100 field so a reel can scale
  them with one number.
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

      {/* The scatter is the house chip itself — the same flat two-ink mark as
          every chip count in the casino, which is the point of using it. */}
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
};
