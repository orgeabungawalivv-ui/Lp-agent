"use client";
import { useState } from "react";
import { Zap } from "lucide-react";
import { fmt, zapSplit } from "@/lib/sim";

interface Props {
  price: number;
  min: number;
  max: number;
  onMint: (usdc: number) => void;
}

export default function ZapSimulator({ price, min, max, onMint }: Props) {
  const [input, setInput] = useState("1000");
  const [minted, setMinted] = useState(false);
  const usdc = Number(input);
  const valid = Number.isFinite(usdc) && usdc > 0;
  const z = valid ? zapSplit(usdc, price, min, max) : null;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Zap className="h-5 w-5 text-emerald-400" /> USDC auto-zap
      </h2>
      <label className="mt-3 block text-sm text-slate-300">
        USDC to deposit
        <input
          inputMode="decimal" value={input}
          onChange={(e) => { setInput(e.target.value); setMinted(false); }}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"
        />
      </label>
      {!valid && <p className="mt-2 text-xs text-red-300">Enter an amount greater than 0.</p>}
      {z && (
        <ol className="mt-3 space-y-1 text-sm text-slate-300">
          <li>1. Keep {fmt(z.reserve)} as the 20% USDC reserve.</li>
          <li>2. Optimal split for {fmt(min)} – {fmt(max)}: {(z.solFrac * 100).toFixed(1)}% SOL / {((1 - z.solFrac) * 100).toFixed(1)}% USDC.</li>
          <li>3. Swap {fmt(z.swapUsdc)} → {z.solAmount.toFixed(4)} SOL at {fmt(price)}.</li>
          <li>4. Mint position with {z.solAmount.toFixed(4)} SOL + {fmt(z.usdcKept)} USDC.</li>
        </ol>
      )}
      <button
        disabled={!valid}
        onClick={() => { onMint(usdc); setMinted(true); }}
        className="mt-3 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
      >
        Simulate zap and mint
      </button>
      {minted && <p className="mt-2 text-xs text-emerald-300">Position minted (simulated). Dashboard updated.</p>}
    </section>
  );
}
