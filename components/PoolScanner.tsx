"use client";
import { useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { MOCK_POOLS, compact, type Pool } from "@/lib/sim";

const score = (p: Pool) => (Math.min(p.vol24h / p.tvl, 5) / 5) * 50 + p.security / 2;

export default function PoolScanner() {
  const [pools, setPools] = useState<Pool[]>(MOCK_POOLS);
  const [minVol, setMinVol] = useState(1_000_000);
  const [minRatio, setMinRatio] = useState(0.5);
  const [minSec, setMinSec] = useState(70);

  const rescan = () =>
    setPools(
      MOCK_POOLS.map((p) => ({
        ...p,
        vol24h: Math.round(p.vol24h * (0.8 + Math.random() * 0.4)),
        security: Math.max(0, Math.min(100, p.security + Math.round((Math.random() - 0.5) * 6))),
      }))
    );

  const rows = useMemo(
    () =>
      pools
        .map((p) => ({ p, ratio: p.vol24h / p.tvl, pass: p.vol24h > minVol && p.vol24h / p.tvl >= minRatio && p.security >= minSec }))
        .sort((a, b) => Number(b.pass) - Number(a.pass) || score(b.p) - score(a.p)),
    [pools, minVol, minRatio, minSec]
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-400" /> Pool scanner
        </h2>
        <button onClick={rescan} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600">
          <RefreshCw className="h-4 w-4" /> Rescan
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-300">
          Min 24h volume
          <select value={minVol} onChange={(e) => setMinVol(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2">
            <option value={500_000}>$500K</option>
            <option value={1_000_000}>$1M</option>
            <option value={10_000_000}>$10M</option>
            <option value={100_000_000}>$100M</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Min volume/TVL: {minRatio.toFixed(1)}x
          <input type="range" min={0} max={5} step={0.1} value={minRatio} onChange={(e) => setMinRatio(Number(e.target.value))} className="mt-3 w-full accent-emerald-400" />
        </label>
        <label className="text-sm text-slate-300">
          Min security score: {minSec}
          <input type="range" min={0} max={100} step={1} value={minSec} onChange={(e) => setMinSec(Number(e.target.value))} className="mt-3 w-full accent-emerald-400" />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-2 pr-3 font-medium">Pool</th>
              <th className="py-2 pr-3 font-medium">DEX</th>
              <th className="py-2 pr-3 font-medium">24h volume</th>
              <th className="py-2 pr-3 font-medium">Vol/TVL</th>
              <th className="py-2 pr-3 font-medium">Security</th>
              <th className="py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, ratio, pass }) => (
              <tr key={p.id} className={`border-t border-slate-700 ${pass ? "" : "opacity-50"}`}>
                <td className="py-2 pr-3 font-medium">{p.pair}</td>
                <td className="py-2 pr-3 text-slate-300">{p.dex}</td>
                <td className="py-2 pr-3">${compact(p.vol24h)}</td>
                <td className="py-2 pr-3">{ratio.toFixed(2)}x</td>
                <td className="py-2 pr-3">{p.security}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${pass ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-600/40 text-slate-400"}`}>
                    {pass ? `Eligible · score ${score(p).toFixed(0)}` : "Filtered out"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
