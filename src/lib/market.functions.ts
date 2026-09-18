import { createServerFn } from "@tanstack/react-start";

type Ticker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  count: number;
};

export type LiveCoin = {
  symbol: string; // e.g. BTCUSDT.P
  base: string; // e.g. BTC
  price: number;
  change: number;
  quoteVolume: number;
  rvol: number;
  oi: number;
  rsi: number;
};


async function openInterestChange(symbol: string): Promise<number> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=6`
    );
    if (!res.ok) return 0;
    const rows = (await res.json()) as { sumOpenInterestValue: string }[];
    const first = Number(rows[0]?.sumOpenInterestValue ?? 0);
    const last = Number(rows[rows.length - 1]?.sumOpenInterestValue ?? 0);
    if (!first || !last) return 0;
    return ((last - first) / first) * 100;
  } catch {
    return 0;
  }
}

/** Real relative volume: most recent completed hour vs the average of the 24 hours before it. */
async function relativeVolume(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=26`
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[][];
    if (rows.length < 25) return null;
    const vols = rows.map((r) => Number(r[7]));
    const current = vols[vols.length - 2] ?? 0; // last completed hour
    const past = vols.slice(0, -2); // 24 completed hours before it
    const avg = past.reduce((s, v) => s + v, 0) / (past.length || 1);
    if (!avg) return null;
    return Number((current / avg).toFixed(2));
  } catch {
    return null;
  }
}


/** Real RSI(14) from the last completed 15m candles. */
async function rsi14(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=100`
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[][];
    const closes = rows.map((r) => Number(r[4]));
    if (closes.length < 20) return null;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= 14; i++) {
      const d = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
      if (d >= 0) gain += d;
      else loss -= d;
    }
    let ag = gain / 14;
    let al = loss / 14;
    for (let i = 15; i < closes.length; i++) {
      const d = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
      ag = (ag * 13 + (d > 0 ? d : 0)) / 14;
      al = (al * 13 + (d < 0 ? -d : 0)) / 14;
    }
    if (!al) return 100;
    const rs = ag / al;
    return Number((100 - 100 / (1 + rs)).toFixed(1));
  } catch {
    return null;
  }
}




/** Top 200 Binance USDT perpetual futures pairs by 24h quote volume. */
export const getTopFutures = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr");
  if (!res.ok) throw new Error(`Binance error ${res.status}`);
  const data = (await res.json()) as Ticker[];

  const usdt = data.filter((t) => t.symbol.endsWith("USDT"));
  const sorted = usdt
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, 200);

  const coins: LiveCoin[] = sorted.map((t) => ({
    symbol: `${t.symbol}.P`,
    base: t.symbol.replace(/USDT$/, ""),
    price: Number(t.lastPrice),
    change: Number(t.priceChangePercent),
    quoteVolume: Number(t.quoteVolume),
    rvol: 1,
    oi: 0,
    rsi: 50,
  }));

  // Real relative volume + open-interest change + RSI(14) for the most active pairs.
  const head = coins.slice(0, 14);
  const [ois, rvols, rsis] = await Promise.all([
    Promise.all(head.map((c) => openInterestChange(c.base + "USDT"))),
    Promise.all(head.map((c) => relativeVolume(c.base + "USDT"))),
    Promise.all(head.map((c) => rsi14(c.base + "USDT"))),
  ]);
  head.forEach((c, i) => {
    c.oi = Number((ois[i] ?? 0).toFixed(2));
    c.rvol = rvols[i] ?? 1;
    c.rsi = rsis[i] ?? 50;
  });


  return { scanned: coins.length, coins, updatedAt: Date.now() };
});

