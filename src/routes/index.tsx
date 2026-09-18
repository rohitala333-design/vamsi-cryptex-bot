import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTopFutures } from "@/lib/market.functions";
import { getNadarayaSignals, type NadarayaSignal } from "@/lib/nadaraya.functions";
import { askVamsi } from "@/lib/vamsi.functions";



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
  rsi: number;
};

type ChatMessage = { role: "user" | "jarvis"; text: string; time: string };
type Alert = { id: number; symbol: string; dir: "up" | "down"; rvol: number; oi: number; time: string };

const TAMIL_GREETING =
  "வணக்கம்! நான் உங்கள் வம்சி. லைவ் மார்க்கெட் ஸ்கேன் பண்ணிட்டு இருக்கேன் — என்ன கேக்கணும்?";
const TAMIL_STOP = "சரிங்க ஏங்க, நான் நிறுத்துறேன். பிறகு சந்திப்போம்!";

function isStopCommand(text: string) {
  const t = text.toLowerCase();
  return t.includes("நிறுத்து") || t.includes("stop") || t.includes("exit");
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

const COLORS = ["#f7931a", "#627eea", "#14f195", "#f3ba2f", "#25a4e8", "#c2a633", "#8b5cf6", "#ec4899", "#22d3ee", "#f97316", "#84cc16", "#e11d48"];

function Dashboard() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [scanned, setScanned] = useState(0);
  const [nwSignals, setNwSignals] = useState<NadarayaSignal[]>([]);
  const [nwTime, setNwTime] = useState("");
  const [feedError, setFeedError] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [heard, setHeard] = useState("");
  const [clock, setClock] = useState(istTime());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "jarvis", text: TAMIL_GREETING, time: istTime() },
  ]);
  const [input, setInput] = useState("");
  const [continuous, setContinuous] = useState(false);
  const continuousRef = useRef(false);
  const alertId = useRef(1);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const sparks = useRef<Record<string, number[]>>({});
  const seenAlert = useRef<Record<string, number>>({});
  const coinsRef = useRef<Coin[]>([]);
  const nwRef = useRef<NadarayaSignal[]>([]);
  coinsRef.current = coins;
  nwRef.current = nwSignals;


  // Nadaraya-Watson 15m envelope scanner
  useEffect(() => {
    let stopped = false;
    const run = async () => {
      try {
        const res = await getNadarayaSignals();
        if (stopped) return;
        setNwSignals(res.signals);
        setNwTime(istTime());
      } catch {
        /* transient network errors are ignored */
      }
    };
    run();
    const id = setInterval(run, 60000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  // Live Binance futures scanner (top 200 USDT perps by 24h volume)
  useEffect(() => {
    let stopped = false;

    const load = async () => {
      try {
        const res = await getTopFutures();
        if (stopped) return;
        setScanned(res.scanned);
        setFeedError("");
        setClock(istTime());

        const live: Coin[] = res.coins.slice(0, 12).map((c, i) => {
          const hist = sparks.current[c.base] ?? [];
          const next = [...hist, c.price].slice(-10);
          sparks.current[c.base] = next;
          return {
            symbol: c.base,
            name: c.symbol,
            price: c.price,
            change: c.change,
            color: COLORS[i % COLORS.length]!,
            holdings: 0,
            spark: next.length > 1 ? next : [c.price, c.price],
            rvol: c.rvol,
            oi: c.oi,
            rsi: c.rsi,
          };
        });
        setCoins(live);


        // Breakout alerts from live price action (>= 4% move in top volume perps)
        const hits = res.coins
          .filter((c) => Math.abs(c.change) >= 4)
          .slice(0, 6);

        if (hits.length) {
          setAlerts((prev) => {
            const fresh = hits
              .filter((h) => Date.now() - (seenAlert.current[h.base] ?? 0) > 120000)
              .map((h) => {
                seenAlert.current[h.base] = Date.now();
                return {
                  id: alertId.current++,
                  symbol: h.symbol,
                  dir: (h.change >= 0 ? "up" : "down") as "up" | "down",
                  rvol: h.rvol,
                  oi: h.oi,
                  time: istTime(),
                };
              });
            return fresh.length ? [...fresh, ...prev].slice(0, 6) : prev;
          });
        }
      } catch {
        if (!stopped) setFeedError("Live feed unreachable — retrying…");
      }
    };

    load();
    const id = setInterval(load, 15000);
    const tick = setInterval(() => setClock(istTime()), 2000);
    return () => {
      stopped = true;
      clearInterval(id);
      clearInterval(tick);
    };
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
    (text?: string, speak = false) => {
      const msg = (text ?? input).trim();
      if (!msg) return;
      setInput("");
      if (isStopCommand(msg)) {
        continuousRef.current = false;
        setContinuous(false);
        setMessages((m) => [
          ...m,
          { role: "user", text: msg, time: istTime() },
          { role: "jarvis", text: TAMIL_STOP, time: istTime() },
        ]);
        if (speak) speakTamil(TAMIL_STOP);
        return;
      }
      setMessages((m) => [...m, { role: "user", text: msg, time: istTime() }]);
      setThinking(true);
      void (async () => {
        let reply: string;
        try {
          const res = await askVamsi({
            data: {
              question: msg,
              snapshot: {
                coins: coinsRef.current.map((c) => ({
                  symbol: c.symbol,
                  price: c.price,
                  change: c.change,
                  rvol: c.rvol,
                  oi: c.oi,
                  rsi: c.rsi,
                })),
                signals: nwRef.current.map((s) => ({
                  symbol: s.symbol,
                  signal: s.signal,
                  price: s.price,
                  timeframe: s.timeframe,
                })),
                portfolioValue: coinsRef.current.reduce(
                  (s, c) => s + c.price * c.holdings,
                  0
                ),
              },
            },
          });
          reply = res.reply;
        } catch {
          reply = "ஏங்க, இப்போ மார்க்கெட் அனாலிசிஸ் கனெக்ஷன்ல சிக்கல். மறுபடி ஒரு தடவை கேளுங்க.";
        }
        setThinking(false);
        setMessages((m) => [...m, { role: "jarvis", text: reply, time: istTime() }]);
        if (speak) speakTamil(reply);
      })();
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
          const said = t || "Give me a market update";
          send(said, true);
          if (continuousRef.current && !isStopCommand(said)) {
            setTimeout(() => {
              if (continuousRef.current) {
                try {
                  rec.start();
                  setListening(true);
                } catch {
                  /* noop */
                }
              }
            }, 2600);
          }
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

  const toggleContinuous = useCallback(() => {
    if (continuousRef.current) {
      continuousRef.current = false;
      setContinuous(false);
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* noop */
        }
      }
      setMessages((m) => [...m, { role: "jarvis", text: TAMIL_STOP, time: istTime() }]);
      speakTamil(TAMIL_STOP);
      return;
    }
    continuousRef.current = true;
    setContinuous(true);
    setMessages((m) => [...m, { role: "jarvis", text: TAMIL_GREETING, time: istTime() }]);
    speakTamil(TAMIL_GREETING);
    setTimeout(() => {
      if (continuousRef.current) startListening();
    }, 3200);
  }, [speakTamil, startListening]);

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
            {feedError || `Scanning ${scanned || 200} Binance futures pairs • ${clock}`}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-40 pt-6">
        {/* Portfolio */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Portfolio Value</p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <span className="text-4xl font-bold tracking-tight">${fmt(portfolio)}</span>
            {portfolio > 0 && (
              <span
                className={`mb-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
                  dayChange >= 0
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {dayChange >= 0 ? "▲" : "▼"} ${fmt(Math.abs(dayChange))} today
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-amber-300">
            {portfolio > 0
              ? "Live positions tracked."
              : "No exchange account connected — no active trades are open."}
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated at {clock}</p>
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge label="RVOL" value={`${c.rvol.toFixed(1)}x`} good={c.rvol >= 1.5} />
                  <Badge label="OI" value={`${c.oi >= 0 ? "+" : ""}${c.oi.toFixed(1)}%`} good={c.oi >= 0} />
                  <Badge label="RSI" value={c.rsi.toFixed(0)} good={c.rsi >= 50} />
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* Nadaraya-Watson 15m signals */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              ✨ Nadaraya-Watson Envelope · 15m
            </h2>
            <span className="text-xs text-slate-500">
              {nwTime ? `Updated at ${nwTime}` : "Scanning…"}
            </span>
          </div>
          <div className="divide-y divide-slate-800">
            {nwSignals.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-500">
                No band touches on the last 15m candle — waiting for the next arrow.
              </p>
            )}
            {nwSignals.map((s) => (
              <div
                key={`${s.symbol}-${s.candleTime}`}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{s.symbol}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    s.signal === "BUY"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {s.signal === "BUY" ? "BUY 🟢 Green Arrow" : "SELL 🔴 Red Arrow"}
                </span>
                <span className="text-xs text-slate-400">
                  Price {s.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </span>
                <span className="text-xs text-slate-500">
                  Band {s.lower.toFixed(4)} – {s.upper.toFixed(4)}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {new Date(s.candleTime).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  IST
                </span>
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
                      <p className="text-xs text-slate-400">{c.name}</p>
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
                        <Badge label="RSI14" value={c.rsi.toFixed(0)} good={c.rsi >= 50} />
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
          <p className="mt-1 text-sm text-blue-200">
            {thinking ? "வம்சி லைவ் டேட்டா அனாலிஸ் பண்ணிட்டு இருக்கு…" : lastJarvis?.text}
          </p>

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
      <div className="fixed inset-x-0 bottom-6 z-10 flex flex-wrap items-center justify-center gap-3 px-4">
        <button
          onClick={toggleContinuous}
          className={`rounded-full border px-4 py-3 text-sm font-semibold shadow-xl transition-colors ${
            continuous
              ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
              : "border-slate-700 bg-slate-800 text-slate-200 hover:border-blue-500"
          }`}
        >
          {continuous ? "🔴 உரையாடலை நிறுத்து" : "🔁 தொடர் உரையாடல்"}
        </button>
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
