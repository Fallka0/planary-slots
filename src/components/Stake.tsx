"use client";

import { useState } from "react";
import { Repeat, Square } from "lucide-react";
import { formatChips, type Machine } from "../../shared/slots";
import { MAX_AUTO_SPINS } from "../../shared/protocol";
import type { Phase } from "@/lib/useMachine";
import { ChipIcon } from "./ChipIcon";

const AUTO_RUNS = [10, 25, 50, MAX_AUTO_SPINS];

/**
 * The stake, the lever and the standing order.
 *
 * The lever is the only large thing on the panel, because pulling it is the
 * only thing that costs anything: the stake it will take is printed on it, so
 * nobody ever presses it to find out.
 */
export function Stake({
  cabinet,
  lineBet,
  setLineBet,
  canChangeBet,
  phase,
  freeSpins,
  autoLeft,
  onSpin,
  onAuto,
  onStopAuto,
  balance,
}: {
  cabinet: Machine;
  lineBet: number;
  setLineBet: (bet: number) => void;
  canChangeBet: boolean;
  phase: Phase;
  freeSpins: number;
  autoLeft: number;
  onSpin: () => void;
  onAuto: (spins: number) => void;
  onStopAuto: () => void;
  balance: number | null;
}) {
  const [showAuto, setShowAuto] = useState(false);
  const total = lineBet * cabinet.lines.length;
  const free = freeSpins > 0;
  const busy = phase !== "idle";
  const broke = !free && balance !== null && balance < total;

  return (
    <div className="stake">
      <div className="stake-bets" role="group" aria-label="Stake per line">
        <span className="stake-label">
          {cabinet.lines.length > 1 ? "Per line" : "Stake"}
          {cabinet.lines.length > 1 ? <em className="num">× {cabinet.lines.length}</em> : null}
        </span>
        <div className="chips">
          {cabinet.lineBets.map((bet) => (
            <button
              key={bet}
              type="button"
              className="chip-bet"
              aria-pressed={bet === lineBet}
              disabled={!canChangeBet}
              onClick={() => setLineBet(bet)}
            >
              <span className="num">{formatChips(bet)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stake-act">
        <button type="button" className="lever" onClick={onSpin} disabled={busy || broke} data-free={free || undefined}>
          <span className="lever-word poster">{free ? "Free spin" : busy ? "Spinning" : "Spin"}</span>
          <span className="lever-cost num">
            {free ? (
              `${freeSpins} left`
            ) : (
              <>
                <ChipIcon size={16} /> {formatChips(total)}
              </>
            )}
          </span>
        </button>

        {autoLeft > 0 ? (
          <button type="button" className="btn btn-quiet auto-stop" onClick={onStopAuto}>
            <Square size={15} aria-hidden="true" />
            Stop <span className="num">({autoLeft})</span>
          </button>
        ) : (
          <div className="auto">
            <button type="button" className="btn btn-quiet" aria-expanded={showAuto} onClick={() => setShowAuto((v) => !v)}>
              <Repeat size={15} aria-hidden="true" />
              Autoplay
            </button>
            {showAuto ? (
              <div className="auto-menu" role="group" aria-label="How many spins">
                {AUTO_RUNS.map((spins) => (
                  <button
                    key={spins}
                    type="button"
                    className="num"
                    onClick={() => {
                      onAuto(spins);
                      setShowAuto(false);
                    }}
                  >
                    {spins}
                  </button>
                ))}
                <p>Stops on its own if a spin is refused, or when your chips run short.</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {broke ? (
        <p className="stake-short">
          {formatChips(total)} is more than you have. Pick a smaller stake, or collect your daily bonus in the lobby.
        </p>
      ) : null}
    </div>
  );
}
