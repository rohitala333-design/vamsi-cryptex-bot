import { createServerFn } from "@tanstack/react-start";
import { getCandles, getOpenInterestChange, getTickers } from "./exchange";

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

/** Real relative volume: most recent completed hour vs the average of the 24 hours before it. */
async function relativeVolume(symbol: string): Promise<number | null> {
  const rows = await getCandles(symbol, "1h", 26);
  if (rows.length < 25) return null;
  const vols = rows.map((r) => r.quoteVolume);
  const current = vols[vols.length - 2] ?? 0; // last completed hour
  const past = vols.slice(0, -2);
  const avg = past.reduce((s, v) => s + v, 0) / (past.length || 1);
  if (!avg) return null;
  return Number((current / avg).toFixed(2));
}

/** Real RSI(14) from the last completed 15m candles. */
async function rsi14(symbol: string): Promise<number | null> {
  const rows = await getCandles(symbol, "15m", 100);
  const closes = rows.map((r) => r.close);
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
}

/** Top 200 USDT perpetual futures pairs by 24h quote volume. */
export const getTopFutures = createServerFn({ method: "GET" }).handler(async () => {
  const tickers = await getTickers();
  if (!tickers.length) throw new Error("Market data providers unreachable");

  const sorted = tickers.sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, 200);

  const coins: LiveCoin[] = sorted.map((t) => ({
    symbol: `${t.symbol}.P`,
    base: t.symbol.replace(/USDT$/, ""),
    price: t.lastPrice,
    change: t.changePercent,
    quoteVolume: t.quoteVolume,
    rvol: 1,
    oi: 0,
    rsi: 50,
  }));

  // Real relative volume + open-interest change + RSI(14) for the most active pairs.
  const head = coins.slice(0, 14);
  const [ois, rvols, rsis] = await Promise.all([
    Promise.all(head.map((c) => getOpenInterestChange(c.base + "USDT"))),
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
