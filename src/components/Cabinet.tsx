import { useId } from "react";
import type { MachineId } from "../../shared/slots";

/*
  A printed cover per machine, drawn in code on a 600 × 800 field — the same
  press as every other table in this casino: one flat field, two or three inks,
  a halftone dot screen fading in toward the bottom, a multiply grain pass, and
  one plate printed about a dozen pixels off register.

  The three covers are the three machines, not three decorations: a full moon
  over the Orbit Wheel, a window of moon coins locking into place, and a
  supernova bursting over five drums with one turned wild. A player should be
  able to tell which is which from the poster alone.
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

/** Points round a centre, alternating two radii. */
function burst(points: number, outer: number, inner: number, cx: number, cy: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** A moon coin, as on the drums. */
function Coin({ cx, cy, r, ring, paper, lit }: { cx: number; cy: number; r: number; ring: string; paper: string; lit?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={lit ? "#fff3c4" : ring} />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={lit ? ring : paper} strokeWidth={r * 0.18} strokeDasharray={`${r * 0.25} ${r * 0.25}`} />
      <circle cx={cx} cy={cy} r={r * 0.52} fill={lit ? ring : paper} />
      <circle cx={cx} cy={cy + r * 0.02} r={r * 0.36} fill={lit ? "#fff3c4" : ring} />
      <circle cx={cx + r * 0.16} cy={cy - r * 0.12} r={r * 0.3} fill={lit ? ring : paper} />
    </g>
  );
}

/** LUNAR PRESS — a full moon over the Orbit Wheel. */
function LunarPress({ id }: { id: string }) {
  const segments = 12;
  return (
    <>
      <rect width="600" height="800" fill="#cc1259" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      {/* The moon, in two plates off register. */}
      <circle cx="402" cy="210" r="150" fill="#ffb3cf" />
      <circle cx="390" cy="222" r="150" fill="#f6eee4" />
      {[
        [330, 170, 26],
        [440, 280, 18],
        [460, 160, 14],
        [360, 300, 10],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#cc1259" opacity="0.18" />
      ))}
      {/* An orbit, and the wheel riding it. */}
      <ellipse cx="300" cy="430" rx="330" ry="70" fill="none" stroke="#2a0710" strokeWidth="8" opacity="0.6" transform="rotate(-10 300 430)" />
      <g transform="translate(205 560)">
        <circle r="168" fill="#2a0710" />
        <circle r="150" fill="#f6eee4" />
        {Array.from({ length: segments }, (_, i) => {
          const a0 = (i * 2 * Math.PI) / segments - Math.PI / 2;
          const a1 = ((i + 1) * 2 * Math.PI) / segments - Math.PI / 2;
          const fill = i % 6 === 3 ? "#d9173c" : i % 2 ? "#cc1259" : "#f6eee4";
          return (
            <path key={i} d={`M0 0L${150 * Math.cos(a0)} ${150 * Math.sin(a0)}A150 150 0 0 1 ${150 * Math.cos(a1)} ${150 * Math.sin(a1)}Z`} fill={fill} />
          );
        })}
        <circle r="40" fill="#2a0710" />
        <path d="M0 -196 18 -160H-18z" fill="#fff3c4" />
      </g>
      <text x="580" y="770" textAnchor="end" fontSize="104" fontWeight="900" fontFamily="var(--font-poster)" fill="#fff3c4" letterSpacing="-2">
        LUNAR
      </text>
    </>
  );
}

/** NINE MOONS — a window of moon coins, some of them locked. */
function NineMoons({ id }: { id: string }) {
  const cell = 128;
  const left = 150;
  const top = 196;
  const lit = new Set(["0-0", "1-1", "2-0", "2-2", "0-2"]);
  return (
    <>
      <rect width="600" height="800" fill="#2438b8" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      <rect x={left - 26} y={top - 14} width={cell * 3 + 40} height={cell * 3 + 40} rx="34" fill="#8ea4ff" />
      <rect x={left - 38} y={top - 2} width={cell * 3 + 40} height={cell * 3 + 40} rx="34" fill="#0f1a52" />
      {[0, 1, 2].map((c) =>
        [0, 1, 2].map((r) => {
          const on = lit.has(`${c}-${r}`);
          return (
            <g key={`${c}-${r}`}>
              <rect x={left - 24 + c * cell} y={top + 14 + r * cell} width={cell - 18} height={cell - 18} rx="16" fill={on ? "#f6eee4" : "#1b2a8f"} />
              {on ? <Coin cx={left + 31 + c * cell} cy={top + 69 + r * cell} r={44} ring="#2438b8" paper="#f6eee4" lit={c === 1 && r === 1} /> : null}
            </g>
          );
        }),
      )}
      <text x="300" y="690" textAnchor="middle" fontSize="88" fontWeight="900" fontFamily="var(--font-poster)" fill="#fff3c4">
        HOLD &amp; WIN
      </text>
      <text x="300" y="752" textAnchor="middle" fontSize="40" fontWeight="800" fontFamily="var(--font-poster)" fill="#f6eee4" letterSpacing="6" opacity="0.85">
        NINE MOONS
      </text>
    </>
  );
}

/** SUPERNOVA — a burst over five drums, one of them turned wild. */
function Supernova({ id }: { id: string }) {
  const w = 92;
  const gap = 14;
  const left = 600 - (w * 5 + gap * 4) - 42;
  return (
    <>
      <rect width="600" height="800" fill="#1a060e" />
      <rect width="600" height="800" fill={`url(#${id}-dots)`} mask={`url(#${id}-fadeMask)`} />
      {/* The nova, in two plates. */}
      <polygon points={burst(16, 300, 150, 312, 190)} fill="#ff2e8a" opacity="0.95" />
      <polygon points={burst(16, 300, 150, 300, 202)} fill="#cc1259" opacity="0.5" style={{ mixBlendMode: "multiply" }} />
      <circle cx="300" cy="196" r="96" fill="#fff3c4" />
      <rect x={left - 24} y="300" width={w * 5 + gap * 4 + 48} height="330" rx="32" fill="#ff2e8a" opacity="0.92" />
      <rect x={left - 36} y="312" width={w * 5 + gap * 4 + 48} height="330" rx="32" fill="#0d0308" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={left - 12 + i * (w + gap)} y={338} width={w} height={278} rx={13} fill={i === 2 ? "#fff3c4" : "#f6eee4"} />
      ))}
      {/* The wild reel: the sun, filling its drum. */}
      <g transform={`translate(${left - 12 + 2 * (w + gap) + w / 2} 477)`}>
        <polygon points={burst(12, 44, 30, 0, 0)} fill="#d9173c" />
        <circle r="28" fill="#1a060e" />
        <text y="8" textAnchor="middle" fontSize="20" fontWeight="900" fontFamily="var(--font-poster)" fill="#fff3c4">
          WILD
        </text>
      </g>
      {/* Portals on reels one and five. */}
      {[
        [left - 12 + w / 2, 400],
        [left - 12 + 4 * (w + gap) + w / 2, 550],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="36" fill="#d9173c" />
          <path
            d={`M${cx} ${cy}m-4 0a4 4 0 1 1 8 0a10 10 0 1 1-20 0a16 16 0 1 1 32 0a22 22 0 1 1-44 0`}
            fill="none"
            stroke="#f6eee4"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>
      ))}
      <text x="40" y="732" fontSize="104" fontWeight="900" fontFamily="var(--font-poster)" fill="#ff2e8a" letterSpacing="-3">
        SUPERNOVA
      </text>
      <text x="44" y="784" fontSize="40" fontWeight="800" fontFamily="var(--font-poster)" fill="#f6eee4" letterSpacing="5" opacity="0.85">
        20 LINES · FREE SPINS
      </text>
    </>
  );
}

const ART: Record<MachineId, { draw: (p: { id: string }) => React.JSX.Element; dot: string }> = {
  cherry: { draw: LunarPress, dot: "#a90e4a" },
  window: { draw: NineMoons, dot: "#1b2a8f" },
  night: { draw: Supernova, dot: "#3a0c1c" },
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
