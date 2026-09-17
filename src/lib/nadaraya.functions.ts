import { createServerFn } from "@tanstack/react-start";

export type NadarayaSignal = {
  symbol: string; // BTC/USDT
  signal: "BUY" | "SELL";
  price: number;
  upper: number;
  lower: number;
  candleTime: number;
  timeframe: string;
};

const TIMEFRAME = "15m";
const BANDWIDTH = 8;
const MULT = 3;
const SCAN_COINS = 40;

/** Rational quadratic kernel regression (Nadaraya-Watson envelope). */
function nadarayaWatson(prices: number[], h = BANDWIDTH, mult = MULT) {
  const n = prices.length;
  const yHat = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sumW = 0;
    let sumWY = 0;
    for (let j = 0; j < n; j++) {
      const d = (i - j) ** 2;
      const w = 1 / (1 + d / (2 * h * h));
      sumW += w;
      sumWY += w * (prices[j] ?? 0);
    }
    yHat[i] = sumW ? sumWY / sumW : (prices[i] ?? 0);
  }
  const mae =
    prices.reduce((s, p, i) => s + Math.abs(p - (yHat[i] ?? p)), 0) / (n || 1);
  const upper = yHat.map((v) => v + mae * mult);
  const lower = yHat.map((v) => v - mae * mult);
  return { yHat, upper, lower };
}

async function scanCoin(symbol: string): Promise<NadarayaSignal | null> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${TIMEFRAME}&limit=100`
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[][];
    if (rows.length < 50) return null;

    const closes = rows.map((r) => Number(r[4]));
    const highs = rows.map((r) => Number(r[2]));
    const lows = rows.map((r) => Number(r[3]));
    const { upper, lower } = nadarayaWatson(closes);

    const i = closes.length - 1;
    const p = i - 1;
    const closeCurr = closes[i] ?? 0;
    const closePrev = closes[p] ?? 0;
    const lowPrev = lows[p] ?? 0;
    const highPrev = highs[p] ?? 0;
    const upPrev = upper[p] ?? 0;
    const loPrev = lower[p] ?? 0;
    const upCurr = upper[i] ?? 0;
    const loCurr = lower[i] ?? 0;

    const buy = lowPrev <= loPrev || (closePrev <= loPrev && closeCurr > loCurr);
    const sell =
      highPrev >= upPrev || (closePrev >= upPrev && closeCurr < upCurr);
    if (!buy && !sell) return null;

    return {
      symbol: symbol.replace(/USDT$/, "/USDT"),
      signal: buy ? "BUY" : "SELL",
      price: closeCurr,
      upper: upCurr,
      lower: loCurr,
      candleTime: Number(rows[i]?.[0] ?? Date.now()),
      timeframe: TIMEFRAME,
    };
  } catch {
    return null;
  }
}

/** Scans the most active Binance USDT perps for 15m Nadaraya-Watson buy/sell arrows. */
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
    for (let i = 0; i < symbols.length; i += 8) {
      const batch = await Promise.all(
        symbols.slice(i, i + 8).map((s) => scanCoin(s))
      );
      batch.forEach((s) => s && signals.push(s));
    }

    return { scanned: symbols.length, signals, updatedAt: Date.now() };
  }
);
