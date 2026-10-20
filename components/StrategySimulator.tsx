"use client";
import { CalendarPlus, OctagonAlert, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { TRIGGER_PCT, evaluate, fmt, type Decision } from "@/lib/sim";

interface Props {
  price: number;
  refPrice: number;
  value: number;
  fees: number;
  stopped: boolean;
  cooldownLeft: number;
  onPriceChange: (price: number) => void;
  onRunCheck: () => void;
  onAccrueDay: () => void;
  onToggleStop: () => void;
  onReset: () => void;
}

const COPY: Record<Decision, { tone: string; title: string }> = {
  REBALANCE: { tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200", title: "REBALANCE — fees exceed rebalance cost" },
  SKIP_COST: { tone: "border-amber-500/50 bg-amber-500/10 text-amber-200", title: "SKIP — price is up, but costs exceed earned fees" },
  HOLD_BEARISH: { tone: "border-sky-500/50 bg-sky-500/10 text-sky-200", title: "HOLD Position — No Rebalance Triggered (Bullish-Only Rule active)" },
  WAIT: { tone: "border-slate-600 bg-slate-700/30 text-slate-300", title: "WAIT — price rise is below the trigger" },
};

export default function StrategySimulator(p: Props) {
  const ev = evaluate(p.price, p.refPrice, p.value, p.fees);
  const pct = ((p.price - p.refPrice) / p.refPrice) * 100;
  const copy = COPY[ev.decision];

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <SlidersHorizontal className="h-5 w-5 text-emerald-400" /> Price shift simulator
      </h2>

      <label className="mt-4 block text-sm text-slate-300">
        SOL price move vs reference: <span className="font-semibold text-slate-100">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
        <span className="ml-2 text-slate-400">({fmt(p.price)})</span>
        <input
          type="range" min={-10} max={10} step={0.5} value={Number(pct.toFixed(1))}
          onChange={(e) => p.onPriceChange(p.refPrice * (1 + Number(e.target.value) / 100))}
          className="mt-3 w-full accent-emerald-400"
        />
        <div className="flex justify-between text-xs text-slate-500"><span>-10%</span><span>0</span><span>+10%</span></div>
      </label>

      <div className={`mt-4 rounded-lg border p-3 text-sm ${copy.tone}`}>
        <p className="font-semibold">{copy.title}</p>
        {(ev.decision === "REBALANCE" || ev.decision === "SKIP_COST") && (
          <dl className="mt-2 grid grid-cols-3 gap-2">
            <div><dt className="text-xs opacity-70">Net fees</dt><dd>{fmt(p.fees)}</dd></div>
            <div><dt className="text-xs opacity-70">Gas + swap cost</dt><dd>{fmt(ev.cost)}</dd></div>
            <div><dt className="text-xs opacity-70">Net</dt><dd>{fmt(ev.net)}</dd></div>
          </dl>
        )}
        {ev.decision === "SKIP_COST" && <p className="mt-2 text-xs">Use “+1 day of fees” to accrue more fees, then run the check again.</p>}
        {ev.decision === "WAIT" && <p className="mt-2 text-xs">Trigger is +{TRIGGER_PCT}%. Move the slider further right.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button onClick={p.onRunCheck} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-slate-900 hover:bg-emerald-400">
          <Play className="h-4 w-4" /> Run strategy check
        </button>
        <button onClick={p.onAccrueDay} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600">
          <CalendarPlus className="h-4 w-4" /> +1 day of fees
        </button>
        <button onClick={p.onToggleStop} className={`flex items-center gap-1 rounded-lg px-3 py-2 ${p.stopped ? "bg-red-500 text-white" : "bg-slate-700 hover:bg-slate-600"}`}>
          <OctagonAlert className="h-4 w-4" /> {p.stopped ? "Resume agent" : "Emergency stop"}
        </button>
        <button onClick={p.onReset} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600">
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>
      {p.cooldownLeft > 0 && <p className="mt-2 text-xs text-amber-300">Cooldown: {p.cooldownLeft}s until the next rebalance is allowed.</p>}
    </section>
  );
}
