import { useId } from "react";
import type { MachineId } from "../../shared/slots";

/*
  A printed cover per machine, drawn in code on a 600 × 800 field — the same
  press as every other table in this casino: one flat field, two or three inks,
  a halftone dot screen fading in toward the bottom, a multiply grain pass, and
  one plate printed about a dozen pixels off register.

  The three covers are the three machines, not three decorations: one row of
  three drums, a nine-window grid, and five drums at night with the house chip
  scattered through them. A player should be able to tell which is which from
  the poster alone.
*/

function PrintDefs({ id, dot }: { id: string; dot: string }) {
  return (
    <defs>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <pattern id={`${id}-dots`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
        <circle cx="7" cy="7" r="3.2" fill={dot} />
      </pattern>
      <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity="1" />
      </linearGradient>
      <mask id={`${id}-fadeMask`}>
        <rect width="600" height="800" fill={`url(#${id}-fade)`} />
      </mask>
    </defs>
  );
}

function Grain({ id }: { id: string }) {
  return <rect width="600" height="800" fill="#000" filter={`url(#${id}-grain)`} opacity="0.35" style={{ mixBlendMode: "multiply" }} />;
}

/** A drum window: cream paper with a shoulder, the way a cabinet holds one. */
function Window({ x, y, w, h, paper = "#f6eee4" }: { x: number; y: number; w: number; h: number; paper?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={w * 0.14} fill={paper} />;
}

function Seven({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight="900" fontFamily="var(--font-poster)" fill={fill}>
      7
    </text>
  );
}

function Cherries({ x, y, scale, ink, paper }: { x: number; y: number; scale: number; ink: string; paper: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M40 10C60 40 50 80 30 110M40 10C70 30 100 70 105 110" stroke={ink} strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="130" r="36" fill={ink} />
      <circle cx="108" cy="130" r="36" fill={ink} />
      <circle cx="20" cy="118" r="8" fill={paper} />
      <circle cx="98" cy="118" r="8" fill={paper} />
    </g>
  );
}

/** CHERRY PRESS — one row of three drums, the lever, and the cherries. */
function CherryPress({ id }: { id: string }) {
  return (
    <>
      <rect width="600" height="800" fill="#cc1259" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      {/* The cabinet, printed in two plates slightly out of line. */}
      <rect x="212" y="208" width="360" height="330" rx="36" fill="#ffb3cf" />
      <rect x="200" y="220" width="360" height="330" rx="36" fill="#2a0710" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Window x={226 + i * 110} y={250} w={92} h={270} />
          <Seven x={272 + i * 110} y={448} size={170} fill="#cc1259" />
        </g>
      ))}
      <rect x="576" y="300" width="14" height="170" rx="7" fill="#2a0710" />
      <circle cx="583" cy="290" r="26" fill="#f6eee4" />
      <Cherries x={250} y={600} scale={1} ink="#b3122e" paper="#f6eee4" />
    </>
  );
}

/** NINE WINDOW — the three-by-three grid, with one line drawn through it. */
function NineWindow({ id }: { id: string }) {
  const cell = 128;
  const left = 150;
  const top = 212;
  // The grid as the machine reads it: columns are reels, rows are rows.
  const grid: ("seven" | "bar" | "bell" | "star" | "cherry")[][] = [
    ["bell", "seven", "bar"],
    ["star", "seven", "cherry"],
    ["cherry", "seven", "bell"],
  ];
  const ink = "#2438b8";
  return (
    <>
      <rect width="600" height="800" fill="#2438b8" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <rect x={left - 26} y={top - 14} width={cell * 3 + 40} height={cell * 3 + 40} rx="34" fill="#8ea4ff" />
      <rect x={left - 38} y={top - 2} width={cell * 3 + 40} height={cell * 3 + 40} rx="34" fill="#0f1a52" />
      {grid.map((column, c) =>
        column.map((pip, r) => (
          <g key={`${c}-${r}`}>
            <Window x={left - 24 + c * cell} y={top + 14 + r * cell} w={cell - 18} h={cell - 18} />
            {pip === "seven" ? <Seven x={left + 31 + c * cell} y={top + 106 + r * cell} size={104} fill={ink} /> : null}
            {pip === "bar" ? (
              <>
                <rect x={left - 8 + c * cell} y={top + 56 + r * cell} width={78} height={28} rx="7" fill={ink} />
                <text
                  x={left + 31 + c * cell}
                  y={top + 78 + r * cell}
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="900"
                  fontFamily="var(--font-poster)"
                  fill="#f6eee4"
                >
                  BAR
                </text>
              </>
            ) : null}
            {pip === "bell" ? (
              <g transform={`translate(${left + 1 + c * cell} ${top + 36 + r * cell}) scale(0.6)`} fill={ink}>
                <path d="M50 14c-16 0-26 11-26 28 0 18-5 26-10 32h72c-5-6-10-14-10-32 0-17-10-28-26-28z" />
                <circle cx="50" cy="12" r="7" />
                <path d="M38 80a12 12 0 0 0 24 0z" />
              </g>
            ) : null}
            {pip === "star" ? (
              <path
                d="M50 10 61 38 92 40 68 59 76 90 50 73 24 90 32 59 8 40 39 38z"
                fill={ink}
                transform={`translate(${left + 1 + c * cell} ${top + 36 + r * cell}) scale(0.6)`}
              />
            ) : null}
            {pip === "cherry" ? <Cherries x={left - 4 + c * cell} y={top + 30 + r * cell} scale={0.52} ink={ink} paper="#f6eee4" /> : null}
          </g>
        )),
      )}
      {/* The centre line, paying: three sevens straight across. */}
      <path d={`M${left - 46} ${top + 14 + cell + (cell - 18) / 2} H${left + cell * 3 - 2}`} stroke="#fff3c4" strokeWidth="9" strokeLinecap="round" />
      <text x="300" y="712" textAnchor="middle" fontSize="92" fontWeight="900" fontFamily="var(--font-poster)" fill="#fff3c4">
        FIVE LINES
      </text>
    </>
  );
}

/** NIGHT PRESS — five drums after dark, chips scattered across them. */
function NightPress({ id }: { id: string }) {
  const drums = [0, 1, 2, 3, 4];
  const w = 92;
  const gap = 14;
  const left = 600 - (w * 5 + gap * 4) - 42;
  return (
    <>
      <rect width="600" height="800" fill="#1a060e" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      {/* The magenta plate, printed off register behind the cabinet. */}
      <rect x={left - 24} y="198" width={w * 5 + gap * 4 + 48} height="366" rx="32" fill="#ff2e8a" opacity="0.92" />
      <rect x={left - 36} y="210" width={w * 5 + gap * 4 + 48} height="366" rx="32" fill="#0d0308" />
      {drums.map((i) => (
        <Window key={i} x={left - 12 + i * (w + gap)} y={236} w={w} h={314} />
      ))}
      {/* Three chips, which is what starts the free spins. */}
      {[
        [left + 34, 300],
        [left + 34 + 2 * (w + gap), 470],
        [left + 34 + 4 * (w + gap), 380],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="40" fill="#d9173c" />
          <circle cx={cx} cy={cy} r="31" fill="none" stroke="#f6eee4" strokeWidth="9" strokeDasharray="12 12" />
          <circle cx={cx} cy={cy} r="20" fill="#f6eee4" />
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="30" fontWeight="900" fontFamily="var(--font-poster)" fill="#d9173c">
            P
          </text>
        </g>
      ))}
      <Seven x={left + 34 + (w + gap)} y={420} size={132} fill="#1a060e" />
      <Seven x={left + 34 + 3 * (w + gap)} y={340} size={132} fill="#1a060e" />
      <text x="40" y="700" fontSize="118" fontWeight="900" fontFamily="var(--font-poster)" fill="#ff2e8a" letterSpacing="-4">
        NIGHT
      </text>
      <text x="40" y="772" fontSize="60" fontWeight="800" fontFamily="var(--font-poster)" fill="#f6eee4" letterSpacing="4" opacity="0.85">
        20 LINES
      </text>
    </>
  );
}

const ART: Record<MachineId, { draw: (p: { id: string }) => React.JSX.Element; dot: string }> = {
  cherry: { draw: CherryPress, dot: "#a90e4a" },
  window: { draw: NineWindow, dot: "#1b2a8f" },
  night: { draw: NightPress, dot: "#3a0c1c" },
};

export function Cabinet({ machine, className, align = "center" }: { machine: MachineId; className?: string; align?: "center" | "right" }) {
  const id = useId().replace(/:/g, "");
  const art = ART[machine];
  const Draw = art.draw;
  return (
    <svg
      viewBox="0 0 600 800"
      className={className}
      preserveAspectRatio={align === "right" ? "xMaxYMid slice" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <PrintDefs id={id} dot={art.dot} />
      <Draw id={id} />
      <Grain id={id} />
    </svg>
  );
}
