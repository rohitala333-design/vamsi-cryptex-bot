import { createServerFn } from "@tanstack/react-start";

export type MarketSnapshot = {
  coins: {
    symbol: string;
    price: number;
    change: number;
    rvol: number;
    oi: number;
    rsi: number;
  }[];
  signals: { symbol: string; signal: string; price: number; timeframe: string }[];
  portfolioValue: number;
};

type Input = { question: string; snapshot: MarketSnapshot };

const SYSTEM = `நீங்கள் "வம்சி" — ஒரு நிஜ-நேர கிரிப்டோ ட்ரேடிங் அசிஸ்டெண்ட்.
Rules:
- Always answer in natural Tamil (Tanglish is fine for trading terms like RSI, RVOL, breakout).
- Address the user as "ஏங்க".
- NEVER invent prices, portfolio balances or trades. Use ONLY the live market data given in the user message.
- If portfolio value is 0 or missing, clearly say no active trades/positions are open.
- Answer the specific question dynamically. No fixed scripts, no repeating the same sentence.
- Base analysis on RSI(14), Nadaraya-Watson envelope signals, RVOL volume spikes and Open Interest change.
- Be short and analytical: 2-4 sentences, end with a clear actionable view (entry / wait / avoid) plus a risk note.`;

export const askVamsi = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const s = data.snapshot;
    const market = s.coins
      .map(
        (c) =>
          `${c.symbol}: price ${c.price}, 24h ${c.change.toFixed(2)}%, RSI14 ${c.rsi.toFixed(1)}, RVOL ${c.rvol.toFixed(2)}x, OI ${c.oi.toFixed(2)}%`
      )
      .join("\n");
    const nw = s.signals.length
      ? s.signals
          .map((g) => `${g.symbol} ${g.signal} @ ${g.price} (${g.timeframe} Nadaraya-Watson)`)
          .join("\n")
      : "No Nadaraya-Watson band touches on the latest candle.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `LIVE MARKET DATA (Binance USDT perps, updated now):
${market}

NADARAYA-WATSON SIGNALS:
${nw}

PORTFOLIO VALUE: $${s.portfolioValue.toFixed(2)} ${s.portfolioValue > 0 ? "" : "(no active trades / not connected to an exchange account)"}

QUESTION: ${data.question}`,
          },
        ],
      }),
    });

    if (res.status === 429)
      return { reply: "ஏங்க, ரொம்ப வேகமா கேக்குறீங்க — ஒரு நிமிஷம் கழிச்சு மறுபடி கேளுங்க." };
    if (res.status === 402)
      return { reply: "ஏங்க, AI கிரெடிட் தீர்ந்துடுச்சு. Lovable-ல கிரெடிட் சேர்த்தா நான் தொடர்ந்து பேசுவேன்." };
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply =
      json.choices?.[0]?.message?.content?.trim() ||
      "ஏங்க, இப்போ பதில் கிடைக்கல. மறுபடி ஒரு தடவை கேளுங்க.";
    return { reply };
  });
