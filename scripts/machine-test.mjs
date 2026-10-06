/**
 * Plays the machine room the way a browser does, and checks every answer.
 *
 *   node scripts/machine-test.mjs
 *
 * Needs the machine room and the casino API running locally, with a stand-in
 * for planary-auth that treats the bearer token as the player:
 *
 *   planary-casino/worker:  npx wrangler dev --port 8788 --var INTERNAL_KEY:test-key
 *   planary-slots:          npx wrangler dev --port 2002 --var INTERNAL_KEY:test-key --var AUTH_API_URL:http://127.0.0.1:8799
 *   an auth stand-in on 127.0.0.1:8799 answering GET /api/auth/me with { user: { id, name } }
 *
 * Every round the machine reports is replayed here from its published seed by
 * the same `play()` the verifier runs, and has to come out identical — reels,
 * bonus game and payout. The balance has to move by exactly what the round
 * staked and returned. LEGACY_PLAYER, when set, names a player who was left
 * holding version-1 free spins; their settlement is checked too.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const staging = mkdtempSync(join(tmpdir(), "planary-machine-"));
for (const name of ["fair.ts", "slots.ts"]) {
  writeFileSync(join(staging, name), readFileSync(join(here, "..", "shared", name), "utf8").replace(/(from "\.\/[A-Za-z]+)"/g, '$1.ts"'));
}
const slots = await import(`file://${join(staging, "slots.ts")}`);
const fair = await import(`file://${join(staging, "fair.ts")}`);

const API = process.env.MACHINE_API ?? "http://127.0.0.1:2002";
const SPINS = Number(process.env.SPINS ?? 60);
const run = Math.random().toString(36).slice(2, 7);

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(player, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${player}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Replays a reported round from its proof and compares everything that matters. */
async function replayMatches(report, lineBet) {
  const cabinet = slots.machineVersion(report.machine, report.version);
  const { serverSeed, clientSeed, nonce, hash } = report.proof;
  const opened = (await fair.commit(serverSeed)) === hash;
  const round = await slots.playFromSeed(cabinet, serverSeed, clientSeed, nonce, lineBet, report.bought);
  const fields = ["stops", "window", "lines", "scatter", "expanded", "basePays", "bonus", "staked", "returned"];
  const diff = fields.filter((f) => !same(round[f], report[f]));
  return { opened, diff };
}

// ── Version 1's free spins, settled on the new machine ──

const legacy = process.env.LEGACY_PLAYER;
if (legacy) {
  console.log(`legacy free spins (${legacy})`);
  const first = await call(legacy, "/v1/state?machine=night");
  const settled = first.body.settled;
  check("the old machine's free spins are settled when the new one opens", settled && settled.spins > 0, JSON.stringify(settled));
  const owed = first.body.history.filter((t) => t.free);
  check("each one is in the history", owed.length === settled?.spins, `${owed.length} vs ${settled?.spins}`);
  check("what they paid adds up", owed.reduce((s, t) => s + t.returned, 0) === settled?.returned);
  check("they stake nothing", owed.every((t) => t.staked === 0));
  const again = await call(legacy, "/v1/state?machine=night");
  check("the notice is shown once", again.body.settled === null);
  check("no free spins are left hanging", !("freeSpins" in again.body) || again.body.freeSpins === 0);
  await wait(800);
  const filed = (await call(legacy, "/v1/state?machine=night")).body.history.filter((t) => t.free && t.roundId);
  check("each settled spin was filed with the casino", filed.length === owed.length, `${filed.length} of ${owed.length}`);
}

// ── Every machine, spun and bought ──

for (const cabinet of slots.MACHINES) {
  const player = `t${run}${cabinet.id}`;
  console.log(`\n${cabinet.name}`);
  const opened = await call(player, `/v1/state?machine=${cabinet.id}`);
  check("opens with an armed commitment", opened.status === 200 && opened.body.armed?.hash?.length === 64, JSON.stringify(opened.body).slice(0, 120));
  let balance = opened.body.balance;
  const lineBet = cabinet.lineBets[0];
  let replays = 0;
  let replayFails = [];
  let money = [];
  let bonuses = 0;
  let lastNonce = 0;
  let nonceOrder = true;

  const play = async (buy) => {
    const armedHash = (await call(player, `/v1/state?machine=${cabinet.id}`)).body.armed?.hash;
    const key = `${player}-${Date.now()}-${Math.random()}`;
    let answer = await call(player, "/v1/spin", { machine: cabinet.id, lineBet, key, buy });
    for (let tries = 0; answer.status === 409 && /One at a time|drawing/.test(answer.body.error) && tries < 10; tries++) {
      await wait(300);
      answer = await call(player, "/v1/spin", { machine: cabinet.id, lineBet, key, buy });
    }
    if (answer.status !== 200) return answer;
    const report = answer.body.spin;
    if (report.proof.hash !== armedHash) replayFails.push(`#${report.nonce} played a different commitment than the one shown`);
    const { opened, diff } = await replayMatches(report, lineBet);
    replays += 1;
    if (!opened || diff.length) replayFails.push(`#${report.nonce}: ${!opened ? "seed does not open the hash; " : ""}${diff.join(", ")}`);
    if (answer.body.balance !== balance - report.staked + report.returned) money.push(`#${report.nonce}: ${balance} − ${report.staked} + ${report.returned} ≠ ${answer.body.balance}`);
    balance = answer.body.balance;
    if (report.nonce !== lastNonce + 1) nonceOrder = false;
    lastNonce = report.nonce;
    if (report.bonus) bonuses += 1;
    await wait(270);
    return answer;
  };

  for (let i = 0; i < SPINS; i++) await play(false);
  const bought = await play(true);
  check("a bonus can be bought", bought.status === 200 && bought.body.spin.bought && bought.body.spin.bonus !== null, JSON.stringify(bought.body).slice(0, 160));
  if (bought.status === 200) {
    const price = slots.buyPrice(cabinet, lineBet);
    check(`it costs ${price} chips (${cabinet.buy}× stake)`, bought.body.spin.staked === price, String(bought.body.spin.staked));
    check("a bought round has no reels", bought.body.spin.stops === null && bought.body.spin.window === null);
  }

  check(`${replays} rounds replay identically from their seeds`, replayFails.length === 0, replayFails.slice(0, 3).join(" | "));
  check("the balance moves by exactly what each round staked and returned", money.length === 0, money.slice(0, 3).join(" | "));
  check("spin numbers count up one at a time", nonceOrder);
  check(`bonus games played: ${bonuses}`, bonuses >= 1);

  // A retried request is the same round, not a second stake.
  const key = `${player}-retry`;
  const once = await call(player, "/v1/spin", { machine: cabinet.id, lineBet, key });
  await wait(30);
  const twice = await call(player, "/v1/spin", { machine: cabinet.id, lineBet, key });
  check("a retried request returns the same round and takes no second stake", once.status === 200 && twice.status === 200 && once.body.spin.nonce === twice.body.spin.nonce && twice.body.balance === once.body.balance);
  balance = twice.body.balance;
  await wait(300);

  const wrong = await call(player, "/v1/spin", { machine: cabinet.id, lineBet: 3, key: `${player}-bad` });
  check("a stake the machine doesn't take is refused", wrong.status === 409 && /stake/.test(wrong.body.error), JSON.stringify(wrong.body));

  const rich = await call(player, "/v1/spin", { machine: cabinet.id, lineBet: cabinet.lineBets.at(-1), key: `${player}-rich`, buy: true });
  const priceTop = slots.buyPrice(cabinet, cabinet.lineBets.at(-1));
  if (priceTop > balance) {
    check("a bonus nobody can afford is refused, and costs nothing", rich.status === 409 && rich.body.balance === balance, JSON.stringify(rich.body));
  }

  await wait(1200);
  const history = (await call(player, `/v1/state?machine=${cabinet.id}`)).body.history;
  check("the history links rounds to the casino's archive", history.slice(1, 6).every((t) => t.roundId), JSON.stringify(history.slice(0, 3)));
  check("bought and bonus rounds are marked in the history", history.some((t) => t.bought) && history.some((t) => t.bonus));
}

const bad = await call(`t${run}x`, "/v1/spin", { machine: "nope", lineBet: 1 });
check("\nan unknown machine is refused", bad.status === 409 || bad.status === 404, JSON.stringify(bad.body));

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
