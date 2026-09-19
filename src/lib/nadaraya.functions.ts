import { createServerFn } from "@tanstack/react-start";

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

type Klines = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastTime: number;
};

/** Nadaraya-Watson with Gaussian kernel + ATR-based envelope (h=8, mult=3). */
function nadarayaWatson({ closes, highs, lows }: Klines): {
  signal: ArrowSignal;
  upper: number;
  lower: number;
} {
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

  // True range, rolling mean over window h, scaled by mult.
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

  // Walk the series and keep the most recent arrow (crossing through a band).
  let signal: ArrowSignal = "NONE";
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1] ?? 0;
    const curr = closes[i] ?? 0;
    if (prev <= (lower[i - 1] ?? 0) && curr > (lower[i] ?? 0)) signal = "UP_ARROW";
    else if (prev >= (upper[i - 1] ?? 0) && curr < (upper[i] ?? 0))
      signal = "DOWN_ARROW";
  }

  return { signal, upper: upper[n - 1] ?? 0, lower: lower[n - 1] ?? 0 };
}

async function fetchKlines(symbol: string, interval: string): Promise<Klines | null> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=100`
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[][];
    if (rows.length < 50) return null;
    return {
      closes: rows.map((r) => Number(r[4])),
      highs: rows.map((r) => Number(r[2])),
      lows: rows.map((r) => Number(r[3])),
      lastTime: Number(rows[rows.length - 1]?.[0] ?? Date.now()),
    };
  } catch {
    return null;
  }
}

async function scanCoin(symbol: string): Promise<NadarayaSignal | null> {
  const [k5, k15, k1h] = await Promise.all(
    TIMEFRAMES.map((tf) => fetchKlines(symbol, tf))
  );
  if (!k15) return null;

  const s5 = k5 ? nadarayaWatson(k5) : null;
  const s15 = nadarayaWatson(k15);
  const s1h = k1h ? nadarayaWatson(k1h) : null;

  const signal_5m: ArrowSignal = s5?.signal ?? "NONE";
  const signal_15m: ArrowSignal = s15.signal;
  const signal_1h: ArrowSignal = s1h?.signal ?? "NONE";

  // Only keep coins with at least one timeframe firing an arrow.
  if (signal_5m === "NONE" && signal_15m === "NONE" && signal_1h === "NONE")
    return null;

  return {
    symbol: symbol.replace(/USDT$/, "/USDT"),
    price: k15.closes[k15.closes.length - 1] ?? 0,
    signal_5m,
    signal_15m,
    signal_1h,
    upper: s15.upper,
    lower: s15.lower,
    candleTime: k15.lastTime,
  };
}

/** Scans the top Binance USDT perps for Nadaraya-Watson arrows on 5m / 15m / 1h. */
export const getNadarayaSignals = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!res.ok) throw new Error(`Binance error ${res.status}`);
    const data = (await res.json()) as { symbol: string; quoteVolume: string }[];

    const symbols = data
      .filter((t) => t.symbol.endsWith("USDT"))
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, SCAN_COINS)
      .map((t) => t.symbol);

    const signals: NadarayaSignal[] = [];
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
      const batch = await Promise.all(
        symbols.slice(i, i + CONCURRENCY).map((s) => scanCoin(s))
      );
      batch.forEach((s) => s && signals.push(s));
    }

    return { scanned: symbols.length, signals, updatedAt: Date.now() };
  }
);
