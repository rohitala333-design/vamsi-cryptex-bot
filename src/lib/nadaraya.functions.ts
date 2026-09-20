import { createServerFn } from "@tanstack/react-start";
import { getCandles, getTickers, type Candle } from "./exchange";

export type ArrowSignal = "UP_ARROW" | "DOWN_ARROW" | "NONE";

export type NadarayaSignal = {
  symbol: string; // BTC/USDT
  price: number;
  signal_5m: ArrowSignal;
  signal_15m: ArrowSignal;
  signal_1h: ArrowSignal;
  upper: number;
  lower: number;
  candleTime: number;
};

const BANDWIDTH = 8;
const MULT = 3.0;
const SCAN_COINS = 200;
const CONCURRENCY = 20;
const TIMEFRAMES = ["5m", "15m", "1h"] as const;

/** Nadaraya-Watson with Gaussian kernel + ATR-based envelope (h=8, mult=3). */
function nadarayaWatson(rows: Candle[]): {
  signal: ArrowSignal;
  upper: number;
  lower: number;
} {
  const closes = rows.map((r) => r.close);
  const highs = rows.map((r) => r.high);
  const lows = rows.map((r) => r.low);
  const n = closes.length;
  const yHat = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    let sumW = 0;
    let sumWX = 0;
    for (let j = 0; j < n; j++) {
      const d = i - j;
      const w = Math.exp(-(d * d) / (2 * BANDWIDTH * BANDWIDTH));
      sumW += w;
      sumWX += w * (closes[j] ?? 0);
    }
    yHat[i] = sumW ? sumWX / sumW : (closes[i] ?? 0);
  }

  const tr = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const h = highs[i] ?? 0;
    const l = lows[i] ?? 0;
    const pc = closes[i - 1] ?? 0;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  const mae = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - BANDWIDTH + 1);
    let sum = 0;
    for (let j = from; j <= i; j++) sum += tr[j] ?? 0;
    mae[i] = (sum / (i - from + 1)) * MULT;
  }

  const upper = yHat.map((v, i) => v + (mae[i] ?? 0));
  const lower = yHat.map((v, i) => v - (mae[i] ?? 0));

  let signal: ArrowSignal = "NONE";
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1] ?? 0;
    const curr = closes[i] ?? 0;
    if (prev <= (lower[i - 1] ?? 0) && curr > (lower[i] ?? 0)) signal = "UP_ARROW";
    else if (prev >= (upper[i - 1] ?? 0) && curr < (upper[i] ?? 0)) signal = "DOWN_ARROW";
  }

  return { signal, upper: upper[n - 1] ?? 0, lower: lower[n - 1] ?? 0 };
}

async function scanCoin(symbol: string): Promise<NadarayaSignal | null> {
  const [k5, k15, k1h] = await Promise.all(TIMEFRAMES.map((tf) => getCandles(symbol, tf, 100)));
  if (!k15 || k15.length < 50) return null;

  const s5 = k5 && k5.length >= 50 ? nadarayaWatson(k5) : null;
  const s15 = nadarayaWatson(k15);
  const s1h = k1h && k1h.length >= 50 ? nadarayaWatson(k1h) : null;

  const signal_5m: ArrowSignal = s5?.signal ?? "NONE";
  const signal_15m: ArrowSignal = s15.signal;
  const signal_1h: ArrowSignal = s1h?.signal ?? "NONE";

  if (signal_5m === "NONE" && signal_15m === "NONE" && signal_1h === "NONE") return null;

  return {
    symbol: symbol.replace(/USDT$/, "/USDT"),
    price: k15[k15.length - 1]?.close ?? 0,
    signal_5m,
    signal_15m,
    signal_1h,
    upper: s15.upper,
    lower: s15.lower,
    candleTime: k15[k15.length - 1]?.time ?? Date.now(),
  };
}

/** Scans the top USDT perps for Nadaraya-Watson arrows on 5m / 15m / 1h. */
export const getNadarayaSignals = createServerFn({ method: "GET" }).handler(async () => {
  const tickers = await getTickers();
  if (!tickers.length) throw new Error("Market data providers unreachable");

  const symbols = tickers
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, SCAN_COINS)
    .map((t) => t.symbol);

  const signals: NadarayaSignal[] = [];
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = await Promise.all(symbols.slice(i, i + CONCURRENCY).map((s) => scanCoin(s)));
    batch.forEach((s) => s && signals.push(s));
  }

  return { scanned: symbols.length, signals, updatedAt: Date.now() };
});
