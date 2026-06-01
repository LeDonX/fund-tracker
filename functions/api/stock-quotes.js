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

    const isFull = url.searchParams.get("full") === "true";

    // Comma join the symbols for a single multi-quote request to Tencent
    // E.g. https://qt.gtimg.cn/q=s_sh600519,s_sz000858,s_usAAPL or for full quotes: https://qt.gtimg.cn/q=sh600519,sz000858
    const qList = symbols.map(sym => isFull ? sym : `s_${sym}`).join(",");
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
    // For full quote: var v_sh600519="51~贵州茅台~600519~1285.88~...~";
    const lines = text.split(";").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Find matches like v_s_sh600519="1~...~" or v_sh600519="51~...~"
      const match = line.match(/(?:var\s+)?v_([a-zA-Z0-9_\.]+)\s*=\s*"([^"]*)"/);
      if (!match) continue;

      const fullKey = match[1]; // e.g. "s_sh600519" or "sh600519"
      const symbolKey = fullKey.replace(/^s_/, "").toLowerCase(); // e.g. "sh600519"
      const dataStr = match[2];

      const parts = dataStr.split("~");
      if (parts.length < 6) continue;

      const isFullQuote = parts.length > 20;

      const price = parseFloat(parts[3]);
      let change = 0;
      let changePercent = 0;
      let name = parts[1];
      let code = parts[2];
      let open = 0;
      let yesterdayClose = 0;
      let high = 0;
      let low = 0;
      let turnover = 0;
      let turnoverRate = 0;
      let pe = 0;
      let pb = 0;
      let floatMarketCap = 0;
      let totalMarketCap = 0;
      let amplitude = 0;
      let limitUp = 0;
      let limitDown = 0;

      if (isFullQuote) {
        yesterdayClose = parseFloat(parts[4]) || 0;
        open = parseFloat(parts[5]) || 0;
        change = parseFloat(parts[31]) || 0;
        changePercent = parseFloat(parts[32]) || 0;
        high = parseFloat(parts[33]) || 0;
        low = parseFloat(parts[34]) || 0;
        turnover = parseFloat(parts[37]) || 0;
        turnoverRate = parseFloat(parts[38]) || 0;
        pe = parseFloat(parts[39]) || 0;
        amplitude = parseFloat(parts[41]) || 0;
        floatMarketCap = parseFloat(parts[42]) || 0;
        totalMarketCap = parseFloat(parts[43]) || 0;
        pb = parseFloat(parts[44]) || 0;
        limitUp = parseFloat(parts[45]) || 0;
        limitDown = parseFloat(parts[46]) || 0;
      } else {
        change = parseFloat(parts[4]) || 0;
        changePercent = parseFloat(parts[5]) || 0;
      }

      if (!isNaN(price)) {
        quotes[symbolKey] = {
          name,
          code,
          price,
          change: isNaN(change) ? 0 : change,
          changePercent: isNaN(changePercent) ? 0 : changePercent,
          open,
          yesterdayClose,
          high,
          low,
          turnover,
          turnoverRate,
          pe,
          pb,
          floatMarketCap,
          totalMarketCap,
          amplitude,
          limitUp,
          limitDown,
          isFull: isFullQuote
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
