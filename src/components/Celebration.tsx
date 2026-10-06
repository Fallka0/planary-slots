"use client";

import { useEffect, useRef, useState } from "react";
import { formatChips } from "../../shared/slots";
import { useSound } from "@/lib/sound";

/*
  A big win, printed big.

  Tiers go by what the round paid against what it cost, so a big win on a
  small stake gets the same poster as one on a large stake. The count runs up
  to a figure that has already been paid — the chips moved before this
  appeared — and a click anywhere skips to it.
*/

export function winTier(returned: number, totalBet: number): { name: string; level: number } | null {
  const multiple = returned / totalBet;
  if (multiple >= 150) return { name: "Stellar win", level: 3 };
  if (multiple >= 40) return { name: "Huge win", level: 2 };
  if (multiple >= 10) return { name: "Big win", level: 1 };
  return null;
}

/** Flat shapes thrown out from the middle: rings, moons and stars. */
const BITS = Array.from({ length: 28 }, (_, i) => ({
  angle: (i / 28) * 360 + (i % 3) * 7,
  distance: 38 + ((i * 37) % 30),
  kind: ["ring", "moon", "star", "dot"][i % 4],
  delay: (i % 7) * 60,
}));

export function Celebration({ amount, totalBet, turbo, onDone }: { amount: number; totalBet: number; turbo: boolean; onDone: () => void }) {
  const sound = useSound();
  const tier = winTier(amount, totalBet)!;
  const [shown, setShown] = useState(0);
  const finished = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const close = () => {
    if (finished.current) return;
    finished.current = true;
    done.current();
  };

  useEffect(() => {
    const length = turbo ? 700 : 1200 + tier.level * 700;
    const begin = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - begin) / length);
      // Fast at first, settling onto the figure.
      setShown(Math.round(amount * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    sound.play(tier.level >= 3 ? "grand" : "big", tier.level + 1);
    const timer = window.setTimeout(close, length + (turbo ? 600 : 1600));
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // Shown once per win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="celebrate" data-level={tier.level} role="status" onClick={() => (shown < amount ? setShown(amount) : close())}>
      <div className="celebrate-burst" aria-hidden="true">
        <svg viewBox="-50 -50 100 100">
          <polygon
            points={Array.from({ length: 32 }, (_, i) => {
              const r = i % 2 ? 26 : 48;
              const a = (Math.PI * i) / 16;
              return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
            }).join(" ")}
          />
        </svg>
      </div>
      <div className="celebrate-bits" aria-hidden="true">
        {BITS.map((bit, i) => (
          <span
            key={i}
            className={`bit bit-${bit.kind}`}
            style={{ "--angle": `${bit.angle}deg`, "--distance": `${bit.distance}vmin`, "--delay": `${bit.delay}ms` } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="celebrate-copy">
        <p className="celebrate-name poster">{tier.name}</p>
        <p className="celebrate-amount poster num">{formatChips(shown)}</p>
        <p className="celebrate-x num">{(amount / totalBet).toFixed(amount / totalBet >= 100 ? 0 : 1)}× your stake</p>
      </div>
    </div>
  );
}
