// Backend Cloudflare Pages Function: CORS Proxy and Cache for Fund Industry Allocation
// Route: GET /api/fund-industry?code=xxxxxx

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "基金代码格式不正确" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Attempt to read from D1 Cache first (if env.DB is bound and initialized)
    if (env.DB) {
      try {
        const cached = await env.DB.prepare(
          "SELECT data_json, last_scraped_at FROM fund_industry_cache WHERE code = ?"
        ).bind(code).first();

        if (cached) {
          const scrapedTime = new Date(cached.last_scraped_at).getTime();
          const ageInMs = Date.now() - scrapedTime;
          const cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days cache TTL

          if (ageInMs < cacheTTL) {
            // Cache Hit: Return cached data
            return new Response(cached.data_json, {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-Cache": "HIT"
              }
            });
          }
        }
      } catch (cacheErr) {
        console.warn("D1 cache read failed, falling back to direct fetch", cacheErr);
      }
    }

    // 2. Cache Miss: Fetch from Eastmoney API
    // The official JSONP API at api.fund.eastmoney.com returns clean data but validates the Referer header.
    const targetUrl = `https://api.fund.eastmoney.com/f10/HYPZ/?fundCode=${code}&year=`;
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://fundf10.eastmoney.com/"
      }
    });

    if (!res.ok) {
      throw new Error(`Eastmoney API error: ${res.status}`);
    }

    const json = await res.json();
    const parsedIndustries = [];

    if (json && json.Data && Array.isArray(json.Data.QuarterInfos) && json.Data.QuarterInfos.length > 0) {
      const latestQuarter = json.Data.QuarterInfos[0];
      if (Array.isArray(latestQuarter.HYPZInfo)) {
        latestQuarter.HYPZInfo.forEach(item => {
          const name = item.HYMC;
          const value = parseFloat(item.ZJZBL);
          if (name && !isNaN(value)) {
            parsedIndustries.push({ name, value });
          }
        });
      }
    }

    // Sort descending by ratio/value
    parsedIndustries.sort((a, b) => b.value - a.value);

    // If no industries found, return a default empty list instead of throwing
    const resultJson = JSON.stringify(parsedIndustries);

    // 3. Write back to D1 Cache (if env.DB is bound)
    if (env.DB && parsedIndustries.length > 0) {
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO fund_industry_cache (code, data_json, last_scraped_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
        ).bind(code, resultJson).run();
      } catch (cacheWriteErr) {
        console.error("D1 cache write failed", cacheWriteErr);
      }
    }

    // Return real parsed data
    return new Response(resultJson, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS"
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `拉取真实数据失败: ${error.message}`, data: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
