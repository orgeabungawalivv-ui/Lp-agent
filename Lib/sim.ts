export type Dex = "Raydium CLMM" | "Orca Whirlpool";
export interface Pool {
  id: string;
  dex: Dex;
  pair: string;
  vol24h: number;
  tvl: number;
  security: number; // 0-100
}
export type Decision = "REBALANCE" | "SKIP_COST" | "HOLD_BEARISH" | "WAIT";
export interface LogEntry {
  id: number;
  time: string;
  kind: "exec" | "skip" | "info";
  msg: string;
}

export const TRIGGER_PCT = 5;
export const RESERVE_PCT = 0.2;
export const GAS_COST_USD = 0.4;
export const SWAP_COST_PCT = 0.003;
export const COOLDOWN_MS = 60_000;
export const FEE_APR = 0.45;

export const MOCK_POOLS: Pool[] = [
  { id: "r1", dex: "Raydium CLMM", pair: "SOL/USDC", vol24h: 182_000_000, tvl: 41_000_000, security: 96 },
  { id: "o1", dex: "Orca Whirlpool", pair: "SOL/USDC", vol24h: 240_000_000, tvl: 78_000_000, security: 97 },
  { id: "r2", dex: "Raydium CLMM", pair: "JUP/USDC", vol24h: 24_000_000, tvl: 9_000_000, security: 90 },
  { id: "o2", dex: "Orca Whirlpool", pair: "BONK/USDC", vol24h: 11_000_000, tvl: 6_000_000, security: 78 },
  { id: "r3", dex: "Raydium CLMM", pair: "WIF/USDC", vol24h: 18_000_000, tvl: 4_200_000, security: 72 },
  { id: "o3", dex: "Orca Whirlpool", pair: "JTO/USDC", vol24h: 3_400_000, tvl: 3_900_000, security: 88 },
  { id: "r4", dex: "Raydium CLMM", pair: "MEME/SOL", vol24h: 620_000, tvl: 300_000, security: 41 },
  { id: "o4", dex: "Orca Whirlpool", pair: "RAY/USDC", vol24h: 1_900_000, tvl: 2_800_000, security: 85 },
];

export const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const compact = (n: number) =>
  n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Impermanent loss fraction for price ratio r (constant-product). */
export const impermanentLoss = (r: number) => 1 - (2 * Math.sqrt(r)) / (1 + r);

/** Bullish-skewed concentrated range around the reference price. */
export const rangeFor = (ref: number) => ({ min: ref * 0.95, max: ref * 1.15 });

/** Approximate LP value: 50/50 entry, concentration amplifies IL x3. */
export function positionValue(base: number, ref: number, price: number) {
  const r = price / ref;
  const il = Math.min(0.9, impermanentLoss(r) * 3);
  return base * (0.5 + 0.5 * r) * (1 - il);
}

export function evaluate(price: number, ref: number, value: number, fees: number) {
  const changePct = ((price - ref) / ref) * 100;
  const cost = value * SWAP_COST_PCT + GAS_COST_USD;
  const net = fees - cost;
  let decision: Decision;
  if (changePct < 0) decision = "HOLD_BEARISH";
  else if (changePct < TRIGGER_PCT) decision = "WAIT";
  else decision = net > 0 ? "REBALANCE" : "SKIP_COST";
  return { changePct, cost, net, decision };
}

/** Split deployable USDC between SOL and USDC for a concentrated range. */
export function zapSplit(usdc: number, price: number, min: number, max: number) {
  const deploy = usdc * (1 - RESERVE_PCT);
  const sp = Math.sqrt(price);
  const sa = Math.sqrt(min);
  const sb = Math.sqrt(max);
  let solFrac: number;
  if (price <= min) solFrac = 1;
  else if (price >= max) solFrac = 0;
  else {
    const solValue = (1 / sp - 1 / sb) * price;
    const usdcValue = sp - sa;
    solFrac = solValue / (solValue + usdcValue);
  }
  const swapUsdc = deploy * solFrac;
  const solAmount = (swapUsdc * (1 - SWAP_COST_PCT)) / price;
  return { deploy, reserve: usdc - deploy, solFrac, swapUsdc, solAmount, usdcKept: deploy - swapUsdc };
}
