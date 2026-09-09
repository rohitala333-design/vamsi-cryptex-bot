import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vamsi AI — Jarvis Crypto Dashboard" },
      {
        name: "description",
        content:
          "Vamsi AI Jarvis — a live crypto dashboard with portfolio tracking, market movers and an AI voice assistant.",
      },
      { property: "og:title", content: "Vamsi AI — Jarvis Crypto Dashboard" },
      {
        property: "og:description",
        content:
          "Live crypto dashboard with portfolio tracking, market movers and an AI voice assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Coin = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  color: string;
  holdings: number;
  spark: number[];
};

const INITIAL_COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 67241.5, change: 2.34, color: "#f7931a", holdings: 0.4821, spark: [64, 65, 63, 66, 68, 67, 69, 71, 70, 72] },
  { symbol: "ETH", name: "Ethereum", price: 3512.8, change: 1.87, color: "#627eea", holdings: 4.25, spark: [52, 54, 53, 55, 57, 56, 58, 60, 59, 61] },
  { symbol: "SOL", name: "Solana", price: 182.44, change: 5.62, color: "#14f195", holdings: 22.5, spark: [30, 32, 31, 34, 33, 36, 38, 37, 40, 42] },
  { symbol: "BNB", name: "BNB Chain", price: 598.12, change: -0.84, color: "#f3ba2f", holdings: 3.1, spark: [44, 43, 45, 44, 42, 43, 41, 42, 40, 41] },
  { symbol: "XRP", name: "Ripple", price: 0.6241, change: -1.23, color: "#25a4e8", holdings: 1240, spark: [22, 23, 21, 22, 20, 21, 19, 20, 18, 19] },
  { symbol: "DOGE", name: "Dogecoin", price: 0.1582, change: 3.41, color: "#c2a633", holdings: 5200, spark: [12, 13, 14, 13, 15, 16, 15, 17, 18, 19] },
];

type ChatMessage = { role: "user" | "jarvis"; text: string };

const JARVIS_REPLIES = [
  "Scanning markets… BTC momentum is strong. Consider holding your position, boss.",
  "Portfolio health looks solid — 68% of holdings are in profit today.",
  "Solana volatility is elevated. I'd set alerts rather than chase entries.",
  "Gas fees are low right now. Good window if you plan to move ETH.",
  "Market sentiment: cautiously bullish. Fear & Greed index sits at 64.",
];

function fmt(n: number, dp = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-20" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="2" />
    </svg>
  );
}

function Dashboard() {
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "jarvis", text: "Good to see you, boss. Markets are live — how can I help?" },
  ]);
  const [input, setInput] = useState("");
  const replyIdx = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live price ticker
  useEffect(() => {
    const id = setInterval(() => {
      setCoins((prev) =>
        prev.map((c) => {
          const drift = (Math.random() - 0.48) * 0.004;
          const price = c.price * (1 + drift);
          return {
            ...c,
            price,
            change: c.change + drift * 100,
            spark: [...c.spark.slice(1), price / (c.symbol === "BTC" ? 1000 : c.symbol === "ETH" ? 60 : c.symbol === "BNB" ? 10 : c.price > 1 ? 5 : 0.003)],
          };
        })
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const portfolio = useMemo(
    () => coins.reduce((sum, c) => sum + c.price * c.holdings, 0),
    [coins]
  );
  const dayChange = useMemo(
    () => coins.reduce((sum, c) => sum + c.price * c.holdings * (c.change / 100), 0),
    [coins]
  );

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "jarvis", text: JARVIS_REPLIES[replyIdx.current++ % JARVIS_REPLIES.length] ?? "" },
      ]);
    }, 900);
  };

  const toggleListen = () => {
    setListening((l) => {
      if (!l) {
        setTimeout(() => {
          setListening(false);
          send("Give me a market update");
        }, 2200);
      }
      return !l;
    });
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold shadow-lg shadow-blue-600/30">
              J
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Vamsi AI</h1>
              <p className="text-xs text-blue-400">Jarvis • Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Markets
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-36 pt-6">
        {/* Portfolio card */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Portfolio Value</p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <span className="text-4xl font-bold tracking-tight">${fmt(portfolio)}</span>
            <span
              className={`mb-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
                dayChange >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              {dayChange >= 0 ? "▲" : "▼"} ${fmt(Math.abs(dayChange))} today
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Assets", value: String(coins.length) },
              { label: "Best performer", value: "SOL +5.6%" },
              { label: "Alerts", value: "3 active" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-800/60 px-2 py-3">
                <p className="text-sm font-semibold">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Market list */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Market Watch
          </h2>
          <div className="space-y-2">
            {coins.map((c) => {
              const up = c.change >= 0;
              return (
                <div
                  key={c.symbol}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 transition-colors hover:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-slate-950"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold">{c.symbol}</p>
                      <p className="text-xs text-slate-400">
                        {c.name} • {fmt(c.holdings, c.holdings > 100 ? 0 : 4)} held
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <Sparkline data={c.spark} up={up} />
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${fmt(c.price, c.price < 1 ? 4 : 2)}</p>
                    <p className={`text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
                      {up ? "+" : ""}
                      {c.change.toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Jarvis chat */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Ask Jarvis
            </h2>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2 border-t border-slate-800 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about markets, portfolio…"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
            <button
              onClick={() => send()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-blue-500"
            >
              Send
            </button>
          </div>
        </section>
      </main>

      {/* Voice button */}
      <div className="fixed inset-x-0 bottom-6 z-10 flex justify-center">
        <button
          onClick={toggleListen}
          className={`flex items-center gap-3 rounded-full px-6 py-4 font-bold shadow-2xl transition-all ${
            listening
              ? "scale-105 bg-red-500 shadow-red-500/40"
              : "bg-blue-600 shadow-blue-600/40 hover:bg-blue-500"
          }`}
        >
          <span className="flex items-end gap-0.5" aria-hidden>
            {[8, 16, 12, 20, 8].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full bg-white ${listening ? "animate-pulse" : ""}`}
                style={{ height: h, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
          {listening ? "LISTENING…" : "🎙️ HOLD TO SPEAK (VAMSI)"}
        </button>
      </div>
    </div>
  );
}
