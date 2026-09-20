/**
 * Resilient market-data client.
 *
 * Binance edge nodes return 403 from some server regions, so every request
 * tries a list of Binance mirrors first and then falls back to Bybit.
 * The working provider is remembered so later calls start with it.
 */

export type Ticker = {
  symbol: string; // BTCUSDT
  lastPrice: number;
  changePercent: number;
  quoteVolume: number;
};

export type Candle = {
  time: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number;
};

const BINANCE_HOSTS = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
];

type Provider = "binance" | "bybit";
let preferred: Provider | null = null;

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Tries each Binance mirror in turn; returns null when every mirror fails. */
async function binance(path: string): Promise<unknown | null> {
  for (const host of BINANCE_HOSTS) {
    const data = await fetchJson(host + path);
    if (data) return data;
  }
  return null;
}

const BYBIT_INTERVAL: Record<string, string> = { "5m": "5", "15m": "15", "1h": "60" };

function providerOrder(): Provider[] {
  return preferred === "bybit" ? ["bybit", "binance"] : ["binance", "bybit"];
}

export async function getTickers(): Promise<Ticker[]> {
  for (const p of providerOrder()) {
    if (p === "binance") {
      const data = (await binance("/fapi/v1/ticker/24hr")) as
        | { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }[]
        | null;
      if (Array.isArray(data) && data.length) {
        preferred = "binance";
        return data
          .filter((t) => t.symbol.endsWith("USDT"))
          .map((t) => ({
            symbol: t.symbol,
            lastPrice: Number(t.lastPrice),
            changePercent: Number(t.priceChangePercent),
            quoteVolume: Number(t.quoteVolume),
          }));
      }
    } else {
      const data = (await fetchJson(
        "https://api.bybit.com/v5/market/tickers?category=linear"
      )) as {
        result?: {
          list?: { symbol: string; lastPrice: string; price24hPcnt: string; turnover24h: string }[];
        };
      } | null;
      const list = data?.result?.list;
      if (Array.isArray(list) && list.length) {
        preferred = "bybit";
        return list
          .filter((t) => t.symbol.endsWith("USDT"))
          .map((t) => ({
            symbol: t.symbol,
            lastPrice: Number(t.lastPrice),
            changePercent: Number(t.price24hPcnt) * 100,
            quoteVolume: Number(t.turnover24h),
          }));
      }
    }
  }
  return [];
}

export async function getCandles(
  symbol: string,
  interval: "5m" | "15m" | "1h",
  limit = 100
): Promise<Candle[]> {
  for (const p of providerOrder()) {
    if (p === "binance") {
      const rows = (await binance(
        `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      )) as unknown[][] | null;
      if (Array.isArray(rows) && rows.length) {
        return rows.map((r) => ({
          time: Number(r[0]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          quoteVolume: Number(r[7]),
        }));
      }
    } else {
      const data = (await fetchJson(
        `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${BYBIT_INTERVAL[interval]}&limit=${limit}`
      )) as { result?: { list?: string[][] } } | null;
      const list = data?.result?.list;
      if (Array.isArray(list) && list.length) {
        // Bybit returns newest first.
        return [...list].reverse().map((r) => ({
          time: Number(r[0]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          quoteVolume: Number(r[6]),
        }));
      }
    }
  }
  return [];
}

/** Percentage change of open interest over the last ~6 hours. */
export async function getOpenInterestChange(symbol: string): Promise<number> {
  for (const p of providerOrder()) {
    if (p === "binance") {
      const rows = (await binance(
        `/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=6`
      )) as { sumOpenInterestValue: string }[] | null;
      if (Array.isArray(rows) && rows.length > 1) {
        const first = Number(rows[0]?.sumOpenInterestValue ?? 0);
        const last = Number(rows[rows.length - 1]?.sumOpenInterestValue ?? 0);
        if (first && last) return ((last - first) / first) * 100;
      }
    } else {
      const data = (await fetchJson(
        `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=1h&limit=6`
      )) as { result?: { list?: { openInterest: string }[] } } | null;
      const list = data?.result?.list;
      if (Array.isArray(list) && list.length > 1) {
        // Bybit returns newest first.
        const last = Number(list[0]?.openInterest ?? 0);
        const first = Number(list[list.length - 1]?.openInterest ?? 0);
        if (first && last) return ((last - first) / first) * 100;
      }
    }
  }
  return 0;
}
