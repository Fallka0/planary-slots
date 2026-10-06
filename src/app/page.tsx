import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MACHINES } from "../../shared/slots";
import { Cabinet } from "@/components/Cabinet";
import { TopBar } from "@/components/TopBar";

/**
 * The parlour: three machines, each sold by its own printed cover.
 * The quiet one, the middle one and the wild one, side by side.
 *
 * The figure on every cabinet is its real return, not a badge — which is the
 * one thing a row of slot machines never tells you, and the reason this page
 * leads with it rather than burying it in a help screen.
 */
export default function Parlour() {
  return (
    <div className="app">
      <TopBar />

      <main className="parlour">
        <div className="parlour-head">
          <h1 className="poster">Three worlds, one orbit</h1>
          <p>
            A quiet three-reeler under a full moon with the Orbit Wheel, a nine-window grid of moon coins that lock for Hold &amp; Win, and
            Supernova, five wild reels with free spins and a multiplier that climbs every spin. Every one of them has its reel strips and its
            bonus tables published, its return printed on the cabinet, and every round — bonus games included — committed to before you pull
            the lever.
          </p>
        </div>

        <ul className="cabinets">
          {MACHINES.map((machine) => (
            <li
              key={machine.id}
              className="cabinet"
              style={{ "--field": machine.field, "--ink": machine.ink } as React.CSSProperties}
            >
              <Link href={`/m/${machine.id}`}>
                <span className="cabinet-art">
                  <Cabinet machine={machine.id} />
                </span>
                <span className="cabinet-copy">
                  <span className="cabinet-name poster">{machine.name}</span>
                  <span className="cabinet-caption poster">{machine.caption}</span>
                  <span className="cabinet-blurb">{machine.blurb}</span>
                  <span className="cabinet-foot">
                    <span className="cabinet-rtp num">
                      {(machine.rtp * 100).toFixed(2)}% back
                      {machine.volatility ? ` · ${machine.volatility === "low" ? "calm" : machine.volatility === "medium" ? "steady" : "wild"}` : ""}
                    </span>
                    <span className="cabinet-go">
                      Play <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="parlour-note">
          Planary Chips are play money: they cannot be bought, sold or exchanged for anything. A machine that returns 96% keeps 4% of
          everything staked over the long run, which is the whole of how it works — stated here because it is true, not because anybody
          asked us to put it somewhere.
        </p>
      </main>
    </div>
  );
}
