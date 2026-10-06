"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Lock, LockOpen } from "lucide-react";
import type { MachineState, SpinReport } from "../../shared/protocol";
import { VERIFY_URL } from "../../shared/protocol";

/** Long hex is unreadable and nobody checks it by eye; the ends are enough to recognise. */
function short(hex: string) {
  return hex.length > 20 ? `${hex.slice(0, 8)}…${hex.slice(-8)}` : hex;
}

/**
 * The commitment, before and after.
 *
 * A machine is the hardest game in a casino to take on trust, so this panel
 * sits open by default rather than hidden behind a pill: above the line is the
 * hash of the seed for the spin that has not happened yet, below it the seed
 * behind the spin that just did. A player can copy either, and the link hands
 * the whole proof to the casino's verifier, which recomputes the spin in their
 * own browser with the same file the machine runs.
 */
export function Fairness({
  state,
  last,
  onSeed,
}: {
  state: MachineState | null;
  last: SpinReport | null;
  onSeed: (value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const saved = Boolean(state?.clientSeed);

  function contribute(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onSeed(value);
    setDraft("");
    input.current?.blur();
  }

  const verify = last
    ? `${VERIFY_URL}?round=${encodeURIComponent(last.roundId ?? "")}`
    : VERIFY_URL;

  return (
    <section className={`panel fair${open ? " is-open" : ""}`} aria-labelledby="fair-title">
      <button type="button" className="panel-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h2 id="fair-title" className="poster">
          Provably fair
        </h2>
        {last ? <LockOpen size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
        <ChevronDown size={16} className="panel-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="panel-body">
          <p className="fair-note">
            The machine draws a seed and shows you its hash <em>before</em> you pull the lever, and publishes the seed itself the moment the
            reels stop. It cannot change the outcome after seeing your stake, and you cannot see the outcome before placing it.
          </p>

          <dl className="fair-proof">
            <div>
              <dt>Next spin, committed</dt>
              <dd className="mono">{state?.armed ? short(state.armed.hash) : "drawing…"}</dd>
            </div>
            <div>
              <dt>Spin number</dt>
              <dd className="num">{state?.armed?.nonce ?? state?.spins ?? 0}</dd>
            </div>
            {last ? (
              <>
                <div>
                  <dt>Last spin, opened</dt>
                  <dd className="mono">{short(last.proof.serverSeed)}</dd>
                </div>
                <div>
                  <dt>Reels stopped at</dt>
                  <dd className="num">{last.stops.join(" · ")}</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Your seed</dt>
              <dd className="mono">{state?.clientSeed ? state.clientSeed : "none — the machine uses an empty one"}</dd>
            </div>
          </dl>

          <form className="fair-seed" onSubmit={contribute}>
            <label htmlFor="client-seed">Add your own seed</label>
            <div className="fair-seed-row">
              <input
                id="client-seed"
                ref={input}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={state?.clientSeed || "anything you like"}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="btn btn-quiet btn-sm" disabled={!draft.trim()}>
                {saved && !draft.trim() ? <Check size={15} aria-hidden="true" /> : null}
                Use
              </button>
            </div>
            <p className="fair-hint">
              Folded into every spin from the next one on. The machine has already committed to its half, so your half cannot be read in
              advance by anyone — including us.
            </p>
          </form>

          <a className="fair-link" href={verify} target="_blank" rel="noreferrer">
            {last?.roundId ? "Check this spin yourself" : "The verifier"}
          </a>
        </div>
      ) : null}
    </section>
  );
}
