"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity, TrendingUp } from "lucide-react";
import PoolScanner from "@/components/PoolScanner";
import StrategySimulator from "@/components/StrategySimulator";
import ZapSimulator from "@/components/ZapSimulator";
import {
  COOLDOWN_MS, FEE_APR, RESERVE_PCT, TRIGGER_PCT,
  evaluate, fmt, impermanentLoss, positionValue, rangeFor, type LogEntry,
} from "@/lib/sim";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const START_PRICE = 150;
const START_DEPOSIT = 10_000;
type Status = "Active" | "Out-of-Range" | "Cooldown" | "Emergency Stop";

const STATUS_STYLE: Record<Status, string> = {
  Active: "bg-emerald-500/20 text-emerald-300",
  "Out-of-Range": "bg-amber-500/20 text-amber-300",
  Cooldown: "bg-sky-500/20 text-sky-300",
  "Emergency Stop": "bg-red-500/20 text-red-300",
};

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [paper, setPaper] = useState(true);
  const [price, setPrice] = useState(START_PRICE);
  const [refPrice, setRefPrice] = useState(START_PRICE);
  const [deposited, setDeposited] = useState(START_DEPOSIT);
  const [base, setBase] = useState(START_DEPOSIT * (1 - RESERVE_PCT));
  const [fees, setFees] = useState(0);
  const [realized, setRealized] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const addLog = (kind: LogEntry["kind"], msg: string) =>
    setLog((l) => [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), kind, msg }, ...l].slice(0, 30));

  const { min, max } = rangeFor(refPrice);
  const inRange = price >= min && price <= max;
  const value = positionValue(base, refPrice, price);
  const reserve = deposited * RESERVE_PCT;
  const portfolio = value + fees + reserve + realized;
  const changePct = ((price - refPrice) / refPrice) * 100;
  const il = impermanentLoss(price / refPrice) * 3 * 100;
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const status: Status = stopped ? "Emergency Stop" : cooldownLeft > 0 ? "Cooldown" : !inRange ? "Out-of-Range" : "Active";

  const runCheck = () => {
    const ev = evaluate(price, refPrice, value, fees);
    if (stopped) return addLog("skip", "Skipped: emergency stop is on. No actions will run.");
    if (cooldownLeft > 0) return addLog("skip", `Skipped: cooldown active for ${cooldownLeft}s more.`);
    if (ev.decision === "HOLD_BEARISH")
      return addLog("skip", `Skipped: price is ${ev.changePct.toFixed(1)}% vs reference. Bullish-only rule: no rebalance on drops.`);
    if (ev.decision === "WAIT")
      return addLog("skip", `Skipped: +${ev.changePct.toFixed(1)}% is below the +${TRIGGER_PCT}% trigger.`);
    if (ev.decision === "SKIP_COST")
      return addLog("skip", `Skipped: trigger met (+${ev.changePct.toFixed(1)}%) but cost ${fmt(ev.cost)} exceeds fees ${fmt(fees)}.`);
    setRealized((r) => r + fees - ev.cost);
    setFees(0);
    setBase(value);
    setRefPrice(price);
    setCooldownUntil(Date.now() + COOLDOWN_MS);
    addLog("exec", `Rebalanced at ${fmt(price)} (+${ev.changePct.toFixed(1)}%). Claimed ${fmt(fees)} fees, paid ${fmt(ev.cost)} costs. New range ${fmt(price * 0.95)} – ${fmt(price * 1.15)}.`);
  };

  const accrueDay = () => {
    if (!inRange) return addLog("info", "No fees earned: price is outside the position range.");
    const earned = (base * FEE_APR) / 365;
    setFees((f) => f + earned);
    addLog("info", `Simulated 1 day in range: +${fmt(earned)} fees.`);
  };

  const mint = (usdc: number) => {
    const factor = value > 0 ? base / value : 1;
    setDeposited((d) => d + usdc);
    setBase((b) => b + usdc * (1 - RESERVE_PCT) * factor);
    addLog("info", `Zap minted: ${fmt(usdc)} USDC deposited (${fmt(usdc * RESERVE_PCT)} held in reserve).`);
  };

  const reset = () => {
    setPrice(START_PRICE); setRefPrice(START_PRICE); setDeposited(START_DEPOSIT);
    setBase(START_DEPOSIT * (1 - RESERVE_PCT)); setFees(0); setRealized(0);
    setStopped(false); setCooldownUntil(0); setLog([]);
  };

  const metrics = [
    { label: "Total deposited", value: fmt(deposited) },
    { label: "Portfolio value", value: fmt(portfolio) },
    { label: "Unallocated reserve (20%)", value: fmt(reserve) },
    { label: "Realized PnL / pending fees", value: `${fmt(realized)} / ${fmt(fees)}` },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-emerald-400" />
          <h1 className="text-xl font-semibold">Solana LP Agent · Bullish-only</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
            Paper trading
          </label>
          <WalletMultiButton />
        </div>
      </header>

      {!paper && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Live mode is a read-only demo. {connected && publicKey ? `Connected as ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}. ` : "Connect a wallet to view it. "}
          No transactions are signed or sent; the simulator below still runs on mock data.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <p className="text-xs text-slate-400">{m.label}</p>
            <p className="mt-1 text-lg font-semibold">{m.value}</p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
          <p className="text-xs text-slate-400">Strategy status</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm font-medium ${STATUS_STYLE[status]}`}>
            {status}{status === "Cooldown" ? ` · ${cooldownLeft}s` : ""}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-emerald-400" /> Active positions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 pr-3 font-medium">DEX</th>
                <th className="py-2 pr-3 font-medium">Pair</th>
                <th className="py-2 pr-3 font-medium">Price vs range</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Fees earned</th>
                <th className="py-2 font-medium">Est. impermanent loss</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-700">
                <td className="py-2 pr-3">Raydium CLMM</td>
                <td className="py-2 pr-3 font-medium">SOL/USDC</td>
                <td className="py-2 pr-3">{fmt(price)} in {fmt(min)} – {fmt(max)}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${inRange ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {inRange ? "In range" : "Out of range"}
                  </span>
                </td>
                <td className="py-2 pr-3">{fmt(fees)}</td>
                <td className="py-2">{il.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <h2 className="text-lg font-semibold">Bullish-only strategy monitor</h2>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-slate-400">Reference</dt><dd>{fmt(refPrice)}</dd></div>
            <div><dt className="text-xs text-slate-400">Current</dt><dd>{fmt(price)}</dd></div>
            <div><dt className="text-xs text-slate-400">Change</dt><dd className={changePct >= 0 ? "text-emerald-300" : "text-red-300"}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</dd></div>
          </dl>
          <p className="mt-4 text-xs text-slate-400">Rebalance trigger: +{TRIGGER_PCT}%</p>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.max(0, Math.min(100, (changePct / TRIGGER_PCT) * 100))}%` }} />
          </div>
          <h3 className="mt-4 text-sm font-medium">Why rebalance ran or was skipped</h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {log.length === 0 && <li className="text-slate-500">No decisions yet. Move the price and run a strategy check.</li>}
            {log.map((l) => (
              <li key={l.id} className={`rounded p-2 ${l.kind === "exec" ? "bg-emerald-500/10 text-emerald-200" : l.kind === "skip" ? "bg-slate-700/50 text-slate-300" : "bg-slate-900/60 text-slate-400"}`}>
                <span className="mr-2 text-slate-500">{l.time}</span>{l.msg}
              </li>
            ))}
          </ul>
        </section>

        <StrategySimulator
          price={price} refPrice={refPrice} value={value} fees={fees}
          stopped={stopped} cooldownLeft={cooldownLeft}
          onPriceChange={setPrice} onRunCheck={runCheck} onAccrueDay={accrueDay}
          onToggleStop={() => { setStopped((s) => !s); addLog("info", stopped ? "Agent resumed." : "Emergency stop engaged."); }}
          onReset={reset}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PoolScanner />
        <ZapSimulator price={price} min={min} max={max} onMint={mint} />
      </div>
    </main>
  );
}
