"use client";

import { useState } from "react";
import { Gauge, Repeat, ShoppingBag, Square } from "lucide-react";
import { buyPrice, formatChips, type Machine, oddsOf } from "../../shared/slots";
import { MAX_AUTO_SPINS } from "../../shared/protocol";
import type { AutoRules, Phase } from "@/lib/useMachine";
import { ChipIcon } from "./ChipIcon";

const AUTO_RUNS = [10, 25, 50, MAX_AUTO_SPINS];
const WIN_STOPS = [0, 20, 50, 100];
const LOSS_STOPS = [0, 50, 100, 250];

const BONUS_NAME = { wheel: "the Orbit Wheel", hold: "Hold & Win", free: "free spins" } as const;

/**
 * The stake, the lever, and everything a real machine puts beside it.
 *
 * The lever is the only large thing on the panel, because pulling it is the
 * thing that costs chips: the stake it will take is printed on it, so nobody
 * presses it to find out. The bonus buy prints its price, and what it returns,
 * before it can be pressed.
 */
export function Stake({
  cabinet,
  lineBet,
  setLineBet,
  canChangeBet,
  phase,
  auto,
  turbo,
  onTurbo,
  onSpin,
  onBuy,
  onAuto,
  onStopAuto,
  balance,
}: {
  cabinet: Machine;
  lineBet: number;
  setLineBet: (bet: number) => void;
  canChangeBet: boolean;
  phase: Phase;
  auto: { left: number } | null;
  turbo: boolean;
  onTurbo: (on: boolean) => void;
  onSpin: () => void;
  onBuy: () => void;
  onAuto: (rules: AutoRules) => void;
  onStopAuto: () => void;
  balance: number | null;
}) {
  const [menu, setMenu] = useState<"auto" | "buy" | null>(null);
  const [rules, setRules] = useState<Omit<AutoRules, "spins">>({ onBonus: true, onWin: 50, lossLimit: 0 });
  const total = lineBet * cabinet.lines.length;
  const busy = phase !== "idle";
  const broke = balance !== null && balance < total;
  const price = buyPrice(cabinet, lineBet);
  const odds = cabinet.feature ? oddsOf(cabinet) : null;
  const canBuy = price !== null && !busy && !auto && (balance === null || balance >= price);

  return (
    <div className="stake">
      <div className="stake-bets" role="group" aria-label="Stake per line">
        <span className="stake-label">
          {cabinet.lines.length > 1 ? "Per line" : "Stake"}
          {cabinet.lines.length > 1 ? <em className="num">× {cabinet.lines.length} = {formatChips(total)}</em> : null}
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
        <div className="stake-tools">
          <button
            type="button"
            className="tool"
            aria-pressed={turbo}
            onClick={() => onTurbo(!turbo)}
            title="Turbo: the drums stop at once"
          >
            <Gauge size={16} aria-hidden="true" />
            Turbo
          </button>

          {auto ? (
            <button type="button" className="tool is-on" onClick={onStopAuto}>
              <Square size={14} aria-hidden="true" />
              Stop <span className="num">({auto.left})</span>
            </button>
          ) : (
            <div className="pop-anchor">
              <button type="button" className="tool" aria-expanded={menu === "auto"} onClick={() => setMenu((m) => (m === "auto" ? null : "auto"))}>
                <Repeat size={15} aria-hidden="true" />
                Auto
              </button>
              {menu === "auto" ? (
                <div className="pop auto-menu" role="dialog" aria-label="Autoplay">
                  <p className="pop-title">Spins</p>
                  <div className="pop-row">
                    {AUTO_RUNS.map((spins) => (
                      <button
                        key={spins}
                        type="button"
                        className="pop-pick num"
                        disabled={busy || broke}
                        onClick={() => {
                          onAuto({ spins, ...rules });
                          setMenu(null);
                        }}
                      >
                        {spins}
                      </button>
                    ))}
                  </div>
                  <label className="pop-check">
                    <input type="checkbox" checked={rules.onBonus} onChange={(e) => setRules((r) => ({ ...r, onBonus: e.target.checked }))} />
                    Stop when a bonus game starts
                  </label>
                  <label className="pop-field">
                    Stop on a win of
                    <select value={rules.onWin} onChange={(e) => setRules((r) => ({ ...r, onWin: Number(e.target.value) }))}>
                      {WIN_STOPS.map((x) => (
                        <option key={x} value={x}>
                          {x ? `${x}× stake or more` : "never"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="pop-field">
                    Stop if down by
                    <select value={rules.lossLimit} onChange={(e) => setRules((r) => ({ ...r, lossLimit: Number(e.target.value) }))}>
                      {LOSS_STOPS.map((x) => (
                        <option key={x} value={x * total}>
                          {x ? `${formatChips(x * total)} chips (${x}× stake)` : "no limit"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="pop-note">Also stops on its own if a spin is refused, or when your chips run short.</p>
                </div>
              ) : null}
            </div>
          )}

          {price !== null && cabinet.feature && odds?.buyRtp ? (
            <div className="pop-anchor">
              <button type="button" className="tool tool-buy" aria-expanded={menu === "buy"} disabled={busy || !!auto} onClick={() => setMenu((m) => (m === "buy" ? null : "buy"))}>
                <ShoppingBag size={15} aria-hidden="true" />
                Buy bonus
              </button>
              {menu === "buy" ? (
                <div className="pop buy-menu" role="dialog" aria-label="Buy the bonus">
                  <p className="pop-title">Buy {BONUS_NAME[cabinet.feature.kind]}</p>
                  <p className="buy-price poster num">
                    <ChipIcon size={22} /> {formatChips(price)}
                  </p>
                  <p className="pop-note">
                    {cabinet.buy}× your stake of {formatChips(total)}. It plays the bonus game straight away, without a spin, and returns{" "}
                    <strong>{(odds.buyRtp * 100).toFixed(2)}%</strong> on average — the same house edge as spinning, worked out from the same
                    tables. Average win {formatChips(odds.buyRtp * price)} chips; most buys pay back less than they cost.
                  </p>
                  <div className="pop-row">
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMenu(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-magenta"
                      disabled={!canBuy}
                      onClick={() => {
                        setMenu(null);
                        onBuy();
                      }}
                    >
                      Buy for {formatChips(price)}
                    </button>
                  </div>
                  {balance !== null && balance < price ? <p className="stake-short">That is more than you have.</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <button type="button" className="lever" onClick={onSpin} disabled={busy || broke || !!auto} data-busy={busy || undefined}>
          <span className="lever-word poster">{busy ? "Spinning" : "Spin"}</span>
          <span className="lever-cost num">
            <ChipIcon size={16} /> {formatChips(total)}
          </span>
        </button>
      </div>

      {broke ? (
        <p className="stake-short">
          {formatChips(total)} is more than you have. Pick a smaller stake, or collect your daily bonus in the lobby.
        </p>
      ) : null}
    </div>
  );
}
