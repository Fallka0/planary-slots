"use client";

import Link from "next/link";
import { AlertCircle, Gift } from "lucide-react";
import { formatChips, machineById, type MachineId } from "../../../../shared/slots";
import { Fairness } from "@/components/Fairness";
import { Paytable } from "@/components/Paytable";
import { Rail } from "@/components/Rail";
import { Reels } from "@/components/Reels";
import { Stake } from "@/components/Stake";
import { TopBar } from "@/components/TopBar";
import { useWallet } from "@/components/WalletProvider";
import { useMachine } from "@/lib/useMachine";

/**
 * One machine, on the floor.
 *
 * The cabinet takes the machine's own field and ink, the way every container
 * in this casino that holds a cover does, and the chrome around it stays the
 * parlour's. Everything that costs chips is on the left under the drums;
 * everything that explains the machine is on the right, open rather than
 * tucked away.
 */
export function Floor({ id }: { id: MachineId }) {
  const cabinet = machineById(id)!;
  const { balance } = useWallet();
  const machine = useMachine(cabinet);
  const { state, phase, result, error, lineBet, freeSpins } = machine;

  // Held back until the drums have stopped, so the figure and the symbols
  // arrive together.
  const landed = phase === "idle" ? result : null;
  const won = landed && landed.returned > 0 ? landed.returned : 0;

  return (
    <div className="app" style={{ "--field": cabinet.field, "--ink": cabinet.ink, "--dot": cabinet.dot } as React.CSSProperties}>
      <TopBar>
        <span className="machine-tag poster">{cabinet.name}</span>
      </TopBar>

      <main className="floor">
        <section className="play">
          <div className="cab" data-spinning={phase !== "idle" || undefined}>
            <div className="cab-print" aria-hidden="true">
              <span className="cab-plate plate-a">{cabinet.lines.length}</span>
              <span className="cab-plate plate-b">{cabinet.lines.length}</span>
            </div>

            <div className="cab-head">
              <h1 className="poster">{cabinet.name}</h1>
              <span className="cab-caption poster">{cabinet.caption}</span>
            </div>

            <Reels cabinet={cabinet} rolling={phase === "spinning"} result={result} onSettled={machine.settled} />

            <div className="cab-read" aria-live="polite">
              {freeSpins > 0 ? (
                <p className="cab-free">
                  <Gift size={16} aria-hidden="true" />
                  {freeSpins} free spin{freeSpins === 1 ? "" : "s"} on the house, at {formatChips(state?.freeSpinBet ?? lineBet)} a line
                </p>
              ) : null}
              {won > 0 ? (
                <p className="cab-win poster">
                  <span className="num">+{formatChips(won)}</span>
                  <em>{landed?.outcome}</em>
                </p>
              ) : landed ? (
                <p className="cab-nothing">{landed.outcome}</p>
              ) : (
                <p className="cab-idle">{phase === "loading" ? "Opening the machine…" : "Committed and waiting."}</p>
              )}
            </div>
          </div>

          <Stake
            cabinet={cabinet}
            lineBet={lineBet}
            setLineBet={machine.setLineBet}
            canChangeBet={machine.canChangeBet}
            phase={phase}
            freeSpins={freeSpins}
            autoLeft={machine.autoLeft}
            onSpin={() => void machine.spin()}
            onAuto={machine.startAuto}
            onStopAuto={machine.stopAuto}
            balance={balance}
          />

          <p className="floor-other">
            Also here:{" "}
            {["cherry", "window", "night"]
              .filter((other) => other !== cabinet.id)
              .map((other, index) => (
                <span key={other}>
                  {index > 0 ? " · " : ""}
                  <Link href={`/m/${other}`}>{machineById(other)!.name}</Link>
                </span>
              ))}
          </p>
        </section>

        <aside className="side">
          <Paytable cabinet={cabinet} lineBet={lineBet} />
          <Fairness state={state} last={landed ?? machine.result} onSeed={(value) => void machine.setSeed(value)} />
          <Rail history={state?.history ?? []} />
        </aside>
      </main>

      {error ? (
        <p className="toast" role="status">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
