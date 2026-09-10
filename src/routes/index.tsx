import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vamsi AI — Jarvis Crypto Dashboard" },
      {
        name: "description",
        content:
          "Vamsi AI Jarvis — live crypto dashboard with breakout signals, momentum scanner and a Tamil-speaking AI voice assistant.",
      },
      { property: "og:title", content: "Vamsi AI — Jarvis Crypto Dashboard" },
      {
        property: "og:description",
        content:
          "Live breakout alerts, momentum coins and a Tamil AI voice assistant in one crypto dashboard.",
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
  rvol: number;
  oi: number;
};

const INITIAL_COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 67241.5, change: 2.34, color: "#f7931a", holdings: 0.4821, spark: [64, 65, 63, 66, 68, 67, 69, 71, 70, 72], rvol: 2.4, oi: 6.8 },
  { symbol: "ETH", name: "Ethereum", price: 3512.8, change: 1.87, color: "#627eea", holdings: 4.25, spark: [52, 54, 53, 55, 57, 56, 58, 60, 59, 61], rvol: 1.9, oi: 4.1 },
  { symbol: "SOL", name: "Solana", price: 182.44, change: 5.62, color: "#14f195", holdings: 22.5, spark: [30, 32, 31, 34, 33, 36, 38, 37, 40, 42], rvol: 3.6, oi: 12.4 },
  { symbol: "BNB", name: "BNB Chain", price: 598.12, change: -0.84, color: "#f3ba2f", holdings: 3.1, spark: [44, 43, 45, 44, 42, 43, 41, 42, 40, 41], rvol: 1.2, oi: -2.3 },
  { symbol: "XRP", name: "Ripple", price: 0.6241, change: -1.23, color: "#25a4e8", holdings: 1240, spark: [22, 23, 21, 22, 20, 21, 19, 20, 18, 19], rvol: 1.6, oi: -5.7 },
  { symbol: "DOGE", name: "Dogecoin", price: 0.1582, change: 3.41, color: "#c2a633", holdings: 5200, spark: [12, 13, 14, 13, 15, 16, 15, 17, 18, 19], rvol: 2.8, oi: 9.2 },
];

type ChatMessage = { role: "user" | "jarvis"; text: string; time: string };
type Alert = { id: number; symbol: string; dir: "up" | "down"; rvol: number; oi: number; time: string };

const JARVIS_REPLIES = [
  "Scanning markets… BTC momentum is strong. Consider holding your position, boss.",
  "Portfolio health looks solid — 68% of holdings are in profit today.",
  "Solana volatility is elevated. I'd set alerts rather than chase entries.",
  "Gas fees are low right now. Good window if you plan to move ETH.",
  "Market sentiment: cautiously bullish. Fear & Greed index sits at 64.",
];

const TAMIL_REPLIES = [
  "ஏங்க, மார்க்கெட் இப்போ நல்லா மேல போகுது. BTC மொமெண்டம் ஸ்ட்ராங்கா இருக்கு.",
  "ஏங்க, உங்க போர்ட்ஃபோலியோ இன்னைக்கு லாபத்துல தான் இருக்கு. கவலைப்படாதீங்க.",
  "ஏங்க, சொலானா ரொம்ப வோலட்டைல். அவசரப்பட்டு வாங்காதீங்க.",
  "ஏங்க, வால்யூம் ஸ்பைக் தெரியுது. பிரேக்அவுட் வர வாய்ப்பு இருக்கு.",
  "ஏங்க, மார்க்கெட் சென்டிமெண்ட் பாசிட்டிவ். ஸ்டாப் லாஸ் மட்டும் வெச்சுக்கோங்க.",
];

const TAMIL_GREETING =
  "வணக்கம்! நான் உங்கள் வம்சி ஜார்விஸ். உங்களுக்கு என்ன உதவி வேண்டும்?";
const TAMIL_STOP = "சரிங்க ஏங்க, நான் நிறுத்துறேன். பிறகு சந்திப்போம்!";

function isStopCommand(text: string) {
  const t = text.toLowerCase();
  return t.includes("நிறுத்து") || t.includes("stop") || t.includes("exit");
}

/** Keyword routing, same idea as the Python assistant's if/elif chain. */
function tamilReplyFor(text: string, fallback: string) {
  const t = text.toLowerCase();
  if (isStopCommand(t)) return TAMIL_STOP;
  if (t.includes("வணக்கம்") || t.includes("hello") || t.includes("hi"))
    return "வணக்கம் ஏங்க! இன்று உங்களுக்கு நான் எப்படி உதவட்டும்?";
  if (t.includes("யார் நீ") || t.includes("உன் பெயர்") || t.includes("who are you"))
    return "ஏங்க, நான் உங்கள் வம்சி ஜார்விஸ் அசிஸ்டெண்ட்.";
  if (t.includes("போர்ட்ஃபோலியோ") || t.includes("portfolio"))
    return "ஏங்க, உங்க போர்ட்ஃபோலியோ இன்னைக்கு லாபத்துல இருக்கு. பெரிய கவலை இல்ல.";
  if (t.includes("பிரேக்அவுட்") || t.includes("breakout"))
    return "ஏங்க, RVOL ஸ்பைக் ஆன கோயின்கள்ல பிரேக்அவுட் வர வாய்ப்பு இருக்கு. அலெர்ட் வெச்சுக்கோங்க.";
  if (t.includes("விலை") || t.includes("price") || t.includes("பிட்காயின்") || t.includes("btc"))
    return "ஏங்க, பிட்காயின் இப்போ மேல்நோக்கி நகருது. மொமெண்டம் ஸ்ட்ராங்கா இருக்கு.";
  return fallback;
}

function istTime(d = new Date()) {
  return (
    d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

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

function Badge({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        good ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      {label} {value}
    </span>
  );
}

function Dashboard() {
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [clock, setClock] = useState(istTime());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "jarvis", text: "Good to see you, boss. Markets are live — how can I help?", time: istTime() },
  ]);
  const [input, setInput] = useState("");
  const [continuous, setContinuous] = useState(false);
  const continuousRef = useRef(false);
  const replyIdx = useRef(0);
  const tamilIdx = useRef(0);
  const alertId = useRef(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  // Live price ticker + scanner
  useEffect(() => {
    const id = setInterval(() => {
      setClock(istTime());
      setCoins((prev) =>
        prev.map((c) => {
          const drift = (Math.random() - 0.48) * 0.004;
          const price = c.price * (1 + drift);
          return {
            ...c,
            price,
            change: c.change + drift * 100,
            rvol: Math.max(0.4, c.rvol + (Math.random() - 0.5) * 0.35),
            oi: c.oi + (Math.random() - 0.5) * 1.4,
            spark: [...c.spark.slice(1), price / (c.symbol === "BTC" ? 1000 : c.symbol === "ETH" ? 60 : c.symbol === "BNB" ? 10 : c.price > 1 ? 5 : 0.003)],
          };
        })
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Breakout alert feed
  useEffect(() => {
    const id = setInterval(() => {
      setCoins((cur) => {
        const c = cur[Math.floor(Math.random() * cur.length)];
        if (c) {
          setAlerts((a) =>
            [
              {
                id: alertId.current++,
                symbol: c.symbol,
                dir: (c.change >= 0 ? "up" : "down") as "up" | "down",
                rvol: c.rvol,
                oi: c.oi,
                time: istTime(),
              },
              ...a,
            ].slice(0, 6)
          );
        }
        return cur;
      });
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const portfolio = useMemo(() => coins.reduce((s, c) => s + c.price * c.holdings, 0), [coins]);
  const dayChange = useMemo(
    () => coins.reduce((s, c) => s + c.price * c.holdings * (c.change / 100), 0),
    [coins]
  );
  const momentum = useMemo(
    () => [...coins].sort((a, b) => b.rvol - a.rvol).slice(0, 3),
    [coins]
  );

  const speakTamil = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ta-IN";
    const v = window.speechSynthesis.getVoices().find((x) => x.lang?.startsWith("ta"));
    if (v) u.voice = v;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, []);

  const send = useCallback(
    (text?: string, tamil = false) => {
      const msg = (text ?? input).trim();
      if (!msg) return;
      setInput("");
      if (tamil && isStopCommand(msg)) {
        continuousRef.current = false;
        setContinuous(false);
      }
      setMessages((m) => [...m, { role: "user", text: msg, time: istTime() }]);
      setTimeout(() => {
        const reply = tamil
          ? tamilReplyFor(msg, TAMIL_REPLIES[tamilIdx.current++ % TAMIL_REPLIES.length]!)
          : JARVIS_REPLIES[replyIdx.current++ % JARVIS_REPLIES.length]!;
        setMessages((m) => [...m, { role: "jarvis", text: reply, time: istTime() }]);
        if (tamil) speakTamil(reply);
      }, 700);
    },
    [input, speakTamil]
  );

  const startListening = useCallback(() => {
    if (listening) return;
    setHeard("");
    setListening(true);
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (SR) {
      const rec = new SR();
      rec.lang = "ta-IN";
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        const t = Array.from(e.results as any[])
          .map((r: any) => r[0].transcript)
          .join(" ");
        setHeard(t);
      };
      rec.onend = () => {
        setListening(false);
        setHeard((t) => {
          send(t || "Give me a market update", true);
          return t;
        });
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch {
        setListening(false);
      }
    } else {
      // Fallback simulation when the browser has no speech recognition
      const demo = "வம்சி, மார்க்கெட் அப்டேட் சொல்லுங்க";
      let i = 0;
      const id = setInterval(() => {
        i += 3;
        setHeard(demo.slice(0, i));
        if (i >= demo.length) {
          clearInterval(id);
          setListening(false);
          send(demo, true);
        }
      }, 90);
    }
  }, [listening, send]);

  const stopListening = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
  }, []);

  const lastJarvis = [...messages].reverse().find((m) => m.role === "jarvis");

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
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
            Scanner live • {clock}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-40 pt-6">
        {/* Portfolio */}
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
          <p className="mt-2 text-xs text-slate-500">Updated at {clock}</p>
        </section>

        {/* Momentum coins */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              🔥 Top Momentum Coins Right Now
            </h2>
            <span className="text-xs text-slate-500">Updated at {clock}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {momentum.map((c) => (
              <div key={c.symbol} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.symbol}</span>
                  <span className={`text-xs ${c.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {c.change >= 0 ? "+" : ""}
                    {c.change.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Volume spike detected</p>
                <div className="mt-2 flex gap-1.5">
                  <Badge label="RVOL" value={`${c.rvol.toFixed(1)}x`} good={c.rvol >= 1.5} />
                  <Badge label="OI" value={`${c.oi >= 0 ? "+" : ""}${c.oi.toFixed(1)}%`} good={c.oi >= 0} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Breakout alerts */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Breakout Alerts
            </h2>
          </div>
          <div className="divide-y divide-slate-800">
            {alerts.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-500">Scanning for breakouts… as of {clock}</p>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="font-semibold">{a.symbol}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    a.dir === "up"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {a.dir === "up" ? "Upside Breakout 🟢" : "Downside Breakout 🔴"}
                </span>
                <Badge label="RVOL" value={`${a.rvol.toFixed(1)}x`} good={a.rvol >= 1.5} />
                <Badge label="OI" value={`${a.oi >= 0 ? "+" : ""}${a.oi.toFixed(1)}%`} good={a.oi >= 0} />
                <span className="ml-auto text-xs text-slate-500">Updated at {a.time}</span>
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
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 transition-colors hover:border-slate-700"
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
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {up ? "Upside Breakout 🟢" : "Downside Breakout 🔴"}
                        </span>
                        <Badge label="RVOL" value={`${c.rvol.toFixed(1)}x`} good={c.rvol >= 1.5} />
                        <Badge
                          label="OI"
                          value={`${c.oi >= 0 ? "+" : ""}${c.oi.toFixed(1)}%`}
                          good={c.oi >= 0}
                        />
                      </div>
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

        {/* Voice response box */}
        <section className="rounded-2xl border border-blue-500/40 bg-blue-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-300">
              Vamsi Voice Response
            </h2>
            <span className="text-xs text-slate-500">{clock}</span>
          </div>
          <p className="text-xs uppercase tracking-wider text-slate-500">You said</p>
          <p className="mt-1 min-h-6 text-sm text-slate-200">
            {heard || (listening ? "Listening…" : "Hold the mic button and speak.")}
          </p>
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">Vamsi replies (Tamil)</p>
          <p className="mt-1 text-sm text-blue-200">{lastJarvis?.text}</p>
          <p className="mt-1 text-xs text-slate-500">Updated at {lastJarvis?.time}</p>
        </section>

        {/* Chat transcript */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Live Transcript
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
                  <span className="mt-1 block text-[10px] opacity-60">{m.time}</span>
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
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={(e) => {
            e.preventDefault();
            startListening();
          }}
          onTouchEnd={stopListening}
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
