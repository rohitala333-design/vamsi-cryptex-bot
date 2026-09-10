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

/** Top 200 Binance USDT perpetual futures pairs by 24h quote volume. */
export const getTopFutures = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr");
  if (!res.ok) throw new Error(`Binance error ${res.status}`);
  const data = (await res.json()) as Ticker[];

  const usdt = data.filter((t) => t.symbol.endsWith("USDT"));
  const sorted = usdt
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, 200);

  const volumes = sorted.map((t) => Number(t.quoteVolume)).sort((a, b) => a - b);
  const median = volumes[Math.floor(volumes.length / 2)] || 1;

  const coins: LiveCoin[] = sorted.map((t) => ({
    symbol: `${t.symbol}.P`,
    base: t.symbol.replace(/USDT$/, ""),
    price: Number(t.lastPrice),
    change: Number(t.priceChangePercent),
    quoteVolume: Number(t.quoteVolume),
    rvol: Number((Number(t.quoteVolume) / median).toFixed(2)),
    oi: 0,
  }));

  // Real open-interest change (last 6h) for the most active pairs.
  const head = coins.slice(0, 12);
  const ois = await Promise.all(head.map((c) => openInterestChange(c.base + "USDT")));
  head.forEach((c, i) => {
    c.oi = Number((ois[i] ?? 0).toFixed(2));
  });

  return { scanned: coins.length, coins, updatedAt: Date.now() };
});
