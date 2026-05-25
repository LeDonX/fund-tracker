// Backend Cloudflare Pages Function: CORS Proxy for Tencent Stock Quotes
// Route: GET /api/stock-quotes?symbols=sh600519,sz000858,usAAPL

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const symbolsParam = url.searchParams.get("symbols");

    if (!symbolsParam) {
      return new Response(
        JSON.stringify({ error: "Missing symbols parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const symbols = symbolsParam
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ quotes: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Comma join the symbols for a single multi-quote request to Tencent
    // E.g. https://qt.gtimg.cn/q=s_sh600519,s_sz000858,s_usAAPL
    const qList = symbols.map(sym => `s_${sym}`).join(",");
    const targetUrl = `https://qt.gtimg.cn/q=${qList}`;

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://finance.sina.com.cn/"
      }
    });

    if (!res.ok) {
      throw new Error(`Tencent API returned HTTP ${res.status}`);
    }

    // Read response text (Tencent uses GBK, but for numbers/tickers ASCII parsing is robust)
    const text = await res.text();
    const quotes = {};

    // Tencent response format: var v_s_sh600519="1~贵州茅台~600519~1285.88~-4.32~-0.33~...~";
    const lines = text.split(";").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Find matches like v_s_sh600519="1~...~"
      const match = line.match(/var\s+v_(s_[a-zA-Z0-9_\.]+)\s*=\s*"([^"]*)"/);
      if (!match) continue;

      const fullKey = match[1]; // e.g. "s_sh600519"
      const symbolKey = fullKey.replace(/^s_/, "").toLowerCase(); // e.g. "sh600519"
      const dataStr = match[2];

      const parts = dataStr.split("~");
      if (parts.length < 6) continue;

      const price = parseFloat(parts[3]);
      const change = parseFloat(parts[4]);
      const changePercent = parseFloat(parts[5]);

      if (!isNaN(price)) {
        quotes[symbolKey] = {
          price,
          change: isNaN(change) ? 0 : change,
          changePercent: isNaN(changePercent) ? 0 : changePercent
        };
      }
    }

    return new Response(
      JSON.stringify({ success: true, quotes }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=15" // Cache quotes for 15 seconds to prevent hammering
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch stock quotes: ${error.message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
