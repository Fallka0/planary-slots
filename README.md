# Planary Slots

Three slot machines for [Planary Casino](https://casino.planary.ch), at
`slots.planary.ch`.

A slot machine is the one game in a casino where the player cannot see the
odds. You are shown the symbols and never how many of each are on the reel, so
there is no way to work out what a combination is worth or how often it lands —
and that is not an oversight, it is the product. This one is built the other way
round.

- **The reel strips are published.** Every stop of every reel is written out in
  [`shared/slots.ts`](shared/slots.ts), in the open, with the paytable beside it.
- **The return is computed, not claimed.** `npm run rtp` works out what each
  machine pays back two independent ways — a closed form over the strips, and
  brute force over every window the machine can show — and fails if either
  disagrees with the figure printed on the cabinet.
- **Every spin is committed to before you pull the lever.** The machine draws a
  seed, shows you only its hash, and publishes the seed the instant the reels
  stop. Not when you ask for a new one: immediately, every time.

All three are built to return **96%**, which means the house keeps 4% of
everything staked over the long run. That is on the cabinet, on the paytable and
in this file, because it is how the machine works.

## The machines

| | Reels | Lines | Returns | Pays on |
| --- | --- | --- | --- | --- |
| **Cherry Press** | 3 × 1 | 1 | 96.00% | 15.2% of spins |
| **Nine Window** | 3 × 3 | 5 | 96.10% | 44.3% of spins |
| **Night Press** | 5 × 3 | 20 | 96.04% | 48.3% of spins |

Cherry Press is the machine everyone pictures: twenty stops a reel, one centre
line, and a lone cherry still pays. Nine Window is a three-by-three grid with
five lines across and through it. Night Press is the modern shape — runs of
three, four and five from the left, plus the house chip as a scatter that pays
wherever it lands and hands back free spins.

One rule pays all three: **a line pays for the run of identical symbols starting
at reel one**, and each symbol has a pay per run length. That is why a classic
machine's one cherry, two cherries and three cherries need no special case, and
why there is only one function to check.

## Shape of the code

| Path | What it holds |
| --- | --- |
| `shared/slots.ts` | The strips, the lines, the paytables, the spin and the odds |
| `shared/fair.ts` | The commitment scheme the whole casino runs on |
| `shared/protocol.ts` | What the machine room and the browser say to each other |
| `machine/machine.ts` | The Durable Object: one per player, and the only thing that knows where the reels will stop |
| `machine/worker.ts` | The door: verifies the Planary token and addresses the right object |
| `src/components/Reels.tsx` | The drums. Openly theatre — the spin was over before the first frame |
| `src/components/Paytable.tsx` | The paytable with the odds on it, worked out as it renders |
| `src/components/Fairness.tsx` | The commitment before, the seed after |
| `scripts/rtp.mjs` | Recomputes every machine's return and refuses to agree with it |

`shared/fair.ts`, `shared/deck.ts`, `shared/slots.ts` and the scripts are
**copies**. They live in `planary-casino/shared` and arrive here through
`scripts/sync-fair.sh`. Never edit a copy: the machine, the archive and the
casino's verifier have to agree to the bit, and a table whose arithmetic has
drifted from the verifier produces spins nobody can check.

## How a spin happens

1. The machine room draws a seed, hashes it, files the commitment with the
   casino and sends the browser **only the hash**. This happens as soon as the
   previous spin resolves, so the hash is already on screen.
2. The player pulls the lever. The casino wallet takes the stake, or refuses it.
3. The stops come out of `HMAC-SHA256(serverSeed, clientSeed:spinNumber)`, one
   per reel, by rejection sampling — never modulo, which would make some stops
   very slightly likelier than others.
4. Winnings are credited, the round is archived, and the seed is published.
5. Anyone can hash the seed to check it matches step 1, then redo step 3. The
   casino's [verifier](https://casino.planary.ch/verify) does it in the browser.

Chips never pass through this app. They live in the `planary-casino-api` wallet,
and the Durable Object moves them over a service binding with the casino's
internal key — which is also why the browser is never told the stake it took,
only the balance that came back.

## Running it

```
npm install
npm run machine   # the machine room, on :2002 (needs planary-casino-api)
npm run dev       # http://localhost:3006
```

`npm run machine` needs `.dev.vars` with an `INTERNAL_KEY` matching
`planary-casino/worker/.dev.vars`, and the casino worker running — the wallet
refuses anything else.

```
npm run rtp       # every machine's return, two ways, exhaustively
npm run fair      # the commitment scheme and the frozen vectors
```

Planary Chips are play money. They cannot be bought, sold or exchanged for
anything, and nothing here is gambling with real money.
