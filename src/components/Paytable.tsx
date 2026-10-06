"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatChips, holdOutcome, type Machine, oddsOf, type Pip as PipId } from "../../shared/slots";
import { Pip, PIP_NAMES } from "./Pip";

/** Paying symbols, top to bottom, across both sets. */
const LADDER: PipId[] = ["nova", "ring", "rocket", "comet", "moon", "seven", "star", "bell", "bar", "cherry"];

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const once = (p: number) => (p > 0 ? `1 in ${formatChips(Math.round(1 / p))}` : "—");

/**
 * The paytable, with the odds on it.
 *
 * A machine's paytable normally tells you what a combination pays and never
 * how often it lands, which is precisely the half that matters. Both halves
 * are here, worked out from shared/slots.ts at the moment this renders — the
 * reels, and the bonus game's wheel, coin table or multipliers too — so the
 * numbers on the right are not marketing copy: they are the same arithmetic
 * the game runs on, and `npm run rtp` checks them against every window the
 * machine can show and a few hundred thousand bonus games.
 */
export function Paytable({ cabinet, lineBet }: { cabinet: Machine; lineBet: number }) {
  const [open, setOpen] = useState(true);
  const odds = useMemo(() => oddsOf(cabinet), [cabinet]);
  const total = lineBet * cabinet.lines.length;

  /** Only the run lengths this machine actually pays for get a column. */
  const runs = useMemo(() => {
    const lengths = new Set<number>();
    for (const table of Object.values(cabinet.pays)) table?.forEach((pays, i) => (pays > 0 ? lengths.add(i + 1) : null));
    return [...lengths].sort((a, b) => a - b);
  }, [cabinet.pays]);

  const ladder = useMemo(() => LADDER.filter((pip) => cabinet.pays[pip]?.some((pays) => pays > 0)), [cabinet.pays]);

  /** How often one line pays this combination, as "1 in N". */
  const chanceOf = (pip: PipId, run: number) => odds.bySymbol.find((row) => row.symbol === pip && row.run === run)?.chance ?? 0;

  const rule = cabinet.feature;

  return (
    <section className={`panel pays${open ? " is-open" : ""}`} aria-labelledby="pays-title">
      <button type="button" className="panel-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h2 id="pays-title" className="poster">
          Paytable
        </h2>
        <span className="pays-rtp num">{(cabinet.rtp * 100).toFixed(2)}%</span>
        <ChevronDown size={16} className="panel-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="panel-body">
          <p className="pay-rule">
            A line pays for {runs.length > 1 ? `${runs.slice(0, -1).join(", ")} or ${runs[runs.length - 1]}` : runs[0]} matching symbols, counted
            from the leftmost reel. Pays are in chips at your stake of {formatChips(lineBet)} a line.
          </p>
          <table className="pay-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Symbol</span>
                </th>
                {runs.map((run) => (
                  <th scope="col" key={run} className="num">
                    {run}
                  </th>
                ))}
                <th scope="col" className="pay-odds">
                  Lands
                </th>
              </tr>
            </thead>
            <tbody>
              {ladder.map((pip) => {
                const best = runs[runs.length - 1];
                const chance = chanceOf(pip, best);
                return (
                  <tr key={pip}>
                    <th scope="row">
                      <Pip pip={pip} size={30} ink="var(--paper)" paper="var(--field)" />
                      <span>{PIP_NAMES[pip]}</span>
                    </th>
                    {runs.map((run) => {
                      const pays = cabinet.pays[pip]?.[run - 1] ?? 0;
                      return (
                        <td key={run} className="num">
                          {pays > 0 ? formatChips(pays * lineBet) : <span className="pay-none">·</span>}
                        </td>
                      );
                    })}
                    <td className="num pay-odds">{once(chance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {cabinet.wild ? (
            <div className="pay-scatter">
              <Pip pip={cabinet.wild.symbol} size={34} ink="var(--paper)" paper="var(--field)" />
              <div>
                <strong>The sun is wild, and fills its reel</strong>
                <p>
                  It lands on reels {cabinet.wild.reels.map((r) => r + 1).join(", ")} only. Where it lands, the whole reel turns wild and stands in
                  for every paying symbol on every line through it.
                </p>
              </div>
            </div>
          ) : null}

          {cabinet.scatter && cabinet.scatter.pays.some((p) => p > 0) ? (
            <div className="pay-scatter">
              <Pip pip={cabinet.scatter.symbol} size={34} ink="var(--paper)" paper="var(--field)" />
              <div>
                <strong>{PIP_NAMES[cabinet.scatter.symbol]}s pay anywhere</strong>
                <p>
                  {cabinet.scatter.pays
                    .map((pays, i) => (pays > 0 ? `${i + 1} pay ${formatChips(pays * total)} (${pays}× your stake)` : null))
                    .filter(Boolean)
                    .join(", ")}
                  , wherever they land.
                </p>
              </div>
            </div>
          ) : null}

          {rule ? (
            <div className="pay-bonus">
              <div className="pay-bonus-head">
                <Pip pip={rule.symbol} size={40} ink="var(--paper)" paper="var(--field)" />
                <div>
                  <strong className="poster">{rule.kind === "wheel" ? "Orbit Wheel" : rule.kind === "hold" ? "Hold & Win" : "Free spins"}</strong>
                  <p>
                    Starts {once(odds.bonusChance)} spins and pays {odds.bonusValue.toFixed(1)}× your stake on average —{" "}
                    {pct(odds.bonusRtp / odds.rtp, 0)} of what the machine returns.
                  </p>
                </div>
              </div>

              {rule.kind === "wheel" ? (
                <>
                  <p className="pay-rule">
                    {rule.count} wheels on the line spin it. Each of its {rule.inner.length} segments is equally likely; the{" "}
                    {rule.inner.filter((v) => v === "up").length} marked UP spin the outer ring, whose {rule.outer.length} segments are equally likely too.
                    Prizes are times your stake.
                  </p>
                  <div className="pay-wheel">
                    <span className="pay-wheel-label">Inner</span>
                    <span className="pay-chips">
                      {rule.inner.map((v, i) => (
                        <em key={i} data-up={v === "up" || undefined} className="num">
                          {v === "up" ? "UP" : `${v}×`}
                        </em>
                      ))}
                    </span>
                    <span className="pay-wheel-label">Outer</span>
                    <span className="pay-chips">
                      {rule.outer.map((v, i) => (
                        <em key={i} className="num">
                          {formatChips(v)}×
                        </em>
                      ))}
                    </span>
                  </div>
                </>
              ) : null}

              {rule.kind === "hold" ? (
                <>
                  <p className="pay-rule">
                    A moon coin on every reel locks them all in place for {rule.respins} respins. On each respin every empty cell takes a coin{" "}
                    {rule.land[0]} time in {rule.land[1]}; a coin that lands locks too and puts the respins back to {rule.respins}. When they run out,
                    the coins are added up. A full window adds the Grand: {rule.grand}× your stake, which happens{" "}
                    {once(holdOutcome(cabinet, rule, rule.trigger).full)} times the game is played.
                  </p>
                  <table className="pay-grid pay-coins">
                    <thead>
                      <tr>
                        <th scope="col">Coin</th>
                        <th scope="col" className="num">
                          Pays
                        </th>
                        <th scope="col" className="pay-odds">
                          Chance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rule.values.map((v) => {
                        const weights = rule.values.reduce((sum, x) => sum + x.weight, 0);
                        return (
                          <tr key={v.value}>
                            <th scope="row">
                              {v.name ?? `${v.value}×`}
                              {v.name ? <span className="pay-odds"> {v.value}×</span> : null}
                            </th>
                            <td className="num">{formatChips(v.value * total)}</td>
                            <td className="num pay-odds">{pct(v.weight / weights)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : null}

              {rule.kind === "free" ? (
                <p className="pay-rule">
                  {rule.trigger} portals anywhere start {rule.spins} free spins at your stake. The first pays ×1, and every free spin after it one more,
                  up to ×{rule.maxMultiplier}. {rule.trigger} portals during the series add {rule.retrigger} spins, up to {rule.maxSpins} in all. Free
                  spins play the same reels as a paid spin.
                </p>
              ) : null}

              {cabinet.buy && odds.buyRtp ? (
                <p className="pay-rule">
                  Buy it outright for {cabinet.buy}× your stake ({formatChips(cabinet.buy * total)} chips); a bought bonus returns{" "}
                  {pct(odds.buyRtp, 2)}.
                </p>
              ) : null}
            </div>
          ) : null}

          <dl className="pay-facts">
            <div>
              <dt>Lines</dt>
              <dd className="num">{cabinet.lines.length}</dd>
            </div>
            <div>
              <dt>Stake</dt>
              <dd className="num">
                {formatChips(lineBet)} × {cabinet.lines.length} = {formatChips(total)}
              </dd>
            </div>
            <div>
              <dt>Pays on</dt>
              <dd className="num">{pct(cabinet.hitRate)} of spins</dd>
            </div>
            <div>
              <dt>Returns</dt>
              <dd className="num">{(cabinet.rtp * 100).toFixed(2)}%</dd>
            </div>
            {cabinet.volatility ? (
              <div>
                <dt>Volatility</dt>
                <dd>{cabinet.volatility === "low" ? "Low: often, small" : cabinet.volatility === "medium" ? "Medium" : "High: rare, large"}</dd>
              </div>
            ) : null}
            {rule ? (
              <div>
                <dt>Bonus game</dt>
                <dd className="num">{once(odds.bonusChance)} spins</dd>
              </div>
            ) : null}
          </dl>

          <p className="pay-note">
            The return above is not an estimate: it is worked out from the reel strips and the bonus tables, which are published in the open, and
            checked against every one of the {formatChips(cabinet.reels.reduce((n, reel) => n * reel.length, 1))} windows this machine can show.{" "}
            {(cabinet.rtp * 100).toFixed(2)}% back means the house keeps {((1 - cabinet.rtp) * 100).toFixed(2)}% of everything staked, in the long run
            — not on your next spin, and not on your next hundred.
          </p>
        </div>
      ) : null}
    </section>
  );
}
