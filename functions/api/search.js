// Backend Cloudflare Pages Function: Search Proxy for Eastmoney Fund suggest API
// Route: GET /api/search?key=xxxxxx

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key || !key.trim()) {
      return new Response(
        JSON.stringify({ success: true, datas: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const keyword = key.trim();
    // Eastmoneyautocomplete search URL: m=1 to only search funds
    const targetUrl = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://fund.eastmoney.com/"
      }
    });

    if (!res.ok) {
      throw new Error(`Eastmoney Search API error: ${res.status}`);
    }

    const data = await res.json();
    const rawDatas = data.Datas || [];

    // Map to simple, clean format
    const results = rawDatas.map(item => ({
      code: item.CODE || "",
      name: item.NAME || "",
      category: item.CATEGORY || "",
      spell: item.SPELL || ""
    }));

    return new Response(
      JSON.stringify({ success: true, datas: results }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400" // Cache results for 24h
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `搜索失败: ${error.message}`, datas: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
