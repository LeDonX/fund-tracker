var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-bw0R8Y/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/pages-11hZui/functionsWorker-0.14590900533490359.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var urls2 = /* @__PURE__ */ new Set();
function checkURL2(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls2.has(url.toString())) {
      urls2.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL2, "checkURL");
__name2(checkURL2, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL2(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
__name2(bytesToHex, "bytesToHex");
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
__name(hexToBytes, "hexToBytes");
__name2(hexToBytes, "hexToBytes");
function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
__name(generateSalt, "generateSalt");
__name2(generateSalt, "generateSalt");
async function hashPassword(password, saltHex) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const saltBytes = hexToBytes(saltHex);
  const derivedKeyBytes = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 1e5,
      hash: "SHA-256"
    },
    passwordKey,
    256
    // Key length in bits (256 bits = 32 bytes)
  );
  return bytesToHex(new Uint8Array(derivedKeyBytes));
}
__name(hashPassword, "hashPassword");
__name2(hashPassword, "hashPassword");
async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const toBase64Url = /* @__PURE__ */ __name2((obj) => {
    const jsonStr = JSON.stringify(obj);
    const binStr = String.fromCharCode(...encoder.encode(jsonStr));
    return btoa(binStr).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }, "toBase64Url");
  const headerB64 = toBase64Url(header);
  const payloadB64 = toBase64Url(payload);
  const tokenInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(tokenInput)
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${tokenInput}.${signatureB64}`;
}
__name(signJWT, "signJWT");
__name2(signJWT, "signJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const tokenInput = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const fromBase64Url = /* @__PURE__ */ __name2((str) => {
      const pad = "=".repeat((4 - str.length % 4) % 4);
      const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
      const binStr = atob(base64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return bytes;
    }, "fromBase64Url");
    const signature = fromBase64Url(signatureB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(tokenInput)
    );
    if (!isValid) return null;
    const payloadBytes = fromBase64Url(payloadB64);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);
    if (payload.exp && Date.now() / 1e3 > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
__name2(verifyJWT, "verifyJWT");
function apiResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
__name(apiResponse, "apiResponse");
__name2(apiResponse, "apiResponse");
globalThis.__MOCK_USERS_DB = globalThis.__MOCK_USERS_DB || [];
async function onRequestPost(context) {
  try {
    const { request, env } = context;
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return apiResponse({ error: "\u65E0\u6548\u7684 JSON \u8BF7\u6C42\u4F53" }, 400);
    }
    const { email, password } = body;
    if (!email || !password) {
      return apiResponse({ error: "\u90AE\u7BB1\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    let user = null;
    let isDemoMode = false;
    if (env.DB) {
      user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalizedEmail).first();
    } else {
      user = globalThis.__MOCK_USERS_DB.find((u) => u.email === normalizedEmail);
      isDemoMode = true;
    }
    if (!user) {
      return apiResponse({ error: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    const passwordHashInput = await hashPassword(password, user.salt);
    if (passwordHashInput !== user.password_hash) {
      return apiResponse({ error: "\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
    }
    const expiration = Math.floor(Date.now() / 1e3) + 24 * 60 * 60;
    const payload = {
      id: user.id,
      email: user.email,
      exp: expiration
    };
    const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
    const jwtToken = await signJWT(payload, jwtSecret);
    const isSecure = request.url.startsWith("https://");
    const cookieString = `auth_token=${jwtToken}; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=86400`;
    const colo = request.cf ? request.cf.colo : null;
    return apiResponse({
      message: "\u767B\u5F55\u6210\u529F",
      user: {
        id: user.id,
        email: user.email
      },
      demo: isDemoMode,
      colo
    }, 200, {
      "Set-Cookie": cookieString,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    });
  } catch (error) {
    return apiResponse({ error: `\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: ${error.message}` }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  });
  return cookies;
}
__name(parseCookies, "parseCookies");
__name2(parseCookies, "parseCookies");
async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const cookieHeader = request.headers.get("Cookie");
    const cookies = parseCookies(cookieHeader);
    const token = cookies["auth_token"];
    const cacheHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };
    if (!token) {
      return apiResponse({ authenticated: false, error: "\u672A\u767B\u5F55" }, 401, cacheHeaders);
    }
    const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      const isSecure = request.url.startsWith("https://");
      const clearCookieString = `auth_token=; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return apiResponse({ authenticated: false, error: "\u4F1A\u8BDD\u8FC7\u671F\u6216\u65E0\u6548" }, 401, {
        "Set-Cookie": clearCookieString,
        ...cacheHeaders
      });
    }
    const colo = request.cf ? request.cf.colo : null;
    return apiResponse({
      authenticated: true,
      user: {
        id: payload.id,
        email: payload.email
      },
      colo
    }, 200, cacheHeaders);
  } catch (error) {
    return apiResponse({ error: `\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: ${error.message}` }, 500);
  }
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost2(context) {
  try {
    const { request } = context;
    const isSecure = request.url.startsWith("https://");
    const clearCookieString = `auth_token=; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return apiResponse({
      message: "\u9000\u51FA\u767B\u5F55\u6210\u529F"
    }, 200, {
      "Set-Cookie": clearCookieString,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
  } catch (error) {
    return apiResponse({ error: `\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: ${error.message}` }, 500);
  }
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
globalThis.__MOCK_USERS_DB = globalThis.__MOCK_USERS_DB || [];
async function onRequestPost3(context) {
  try {
    const { request, env } = context;
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return apiResponse({ error: "\u65E0\u6548\u7684 JSON \u8BF7\u6C42\u4F53" }, 400);
    }
    const { email, password } = body;
    if (!email || !password) {
      return apiResponse({ error: "\u90AE\u7BB1\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse({ error: "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E" }, 400);
    }
    if (password.length < 6) {
      return apiResponse({ error: "\u5BC6\u7801\u957F\u5EA6\u5FC5\u987B\u81F3\u5C11\u4E3A 6 \u4F4D" }, 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    if (env.DB) {
      const existingUser = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalizedEmail).first();
      if (existingUser) {
        return apiResponse({ error: "\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C" }, 400);
      }
      await env.DB.prepare("INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)").bind(normalizedEmail, passwordHash, salt).run();
      return apiResponse({ message: "\u6CE8\u518C\u6210\u529F", mode: "D1_DATABASE" }, 201);
    } else {
      const existingUser = globalThis.__MOCK_USERS_DB.find((u) => u.email === normalizedEmail);
      if (existingUser) {
        return apiResponse({ error: "\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C(\u6A21\u62DF\u5E93)" }, 400);
      }
      globalThis.__MOCK_USERS_DB.push({
        id: globalThis.__MOCK_USERS_DB.length + 1,
        email: normalizedEmail,
        password_hash: passwordHash,
        salt,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return apiResponse({
        message: "\u6CE8\u518C\u6210\u529F\uFF08\u8FD0\u884C\u5728\u672A\u7ED1\u5B9A\u6570\u636E\u5E93\u7684\u6F14\u793A\u6A21\u5F0F\u4E2D\uFF0C\u6570\u636E\u4FDD\u5B58\u5728\u5185\u5B58\u4E2D\uFF09",
        mode: "DEMO_MEMORY"
      }, 201);
    }
  } catch (error) {
    return apiResponse({ error: `\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: ${error.message}` }, 500);
  }
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
function parseCookies2(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  });
  return cookies;
}
__name(parseCookies2, "parseCookies2");
__name2(parseCookies2, "parseCookies");
async function getAuthenticatedUser(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies2(cookieHeader);
  const token = cookies["auth_token"];
  if (!token) return null;
  const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
  return await verifyJWT(token, jwtSecret);
}
__name(getAuthenticatedUser, "getAuthenticatedUser");
__name2(getAuthenticatedUser, "getAuthenticatedUser");
async function onRequestGet2(context) {
  try {
    const user = await getAuthenticatedUser(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const rows = await env.DB.prepare(
      "SELECT id, fund_code, date, daily_profit FROM user_fund_daily_profits WHERE user_id = ? ORDER BY date DESC"
    ).bind(user.id).all();
    const dailyProfits = (rows.results || []).map((row) => ({
      id: row.id,
      fundCode: row.fund_code,
      date: row.date,
      dailyProfit: Number(row.daily_profit || 0)
    }));
    return apiResponse({ success: true, dailyProfits });
  } catch (error) {
    return apiResponse({ error: `\u62C9\u53D6\u6BCF\u65E5\u6536\u76CA\u5386\u53F2\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestGet3(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code || !/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "\u57FA\u91D1\u4EE3\u7801\u683C\u5F0F\u4E0D\u6B63\u786E" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (env.DB) {
      try {
        const cached = await env.DB.prepare(
          "SELECT data_json, last_scraped_at FROM fund_industry_cache WHERE code = ?"
        ).bind(code).first();
        if (cached) {
          const scrapedTime = new Date(cached.last_scraped_at).getTime();
          const ageInMs = Date.now() - scrapedTime;
          const cacheTTL = 7 * 24 * 60 * 60 * 1e3;
          if (ageInMs < cacheTTL) {
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
        latestQuarter.HYPZInfo.forEach((item) => {
          const name = item.HYMC;
          const value = parseFloat(item.ZJZBL);
          if (name && !isNaN(value)) {
            parsedIndustries.push({ name, value });
          }
        });
      }
    }
    parsedIndustries.sort((a, b) => b.value - a.value);
    const resultJson = JSON.stringify(parsedIndustries);
    if (env.DB && parsedIndustries.length > 0) {
      try {
        await env.DB.prepare(
          "INSERT OR REPLACE INTO fund_industry_cache (code, data_json, last_scraped_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
        ).bind(code, resultJson).run();
      } catch (cacheWriteErr) {
        console.error("D1 cache write failed", cacheWriteErr);
      }
    }
    return new Response(resultJson, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `\u62C9\u53D6\u771F\u5B9E\u6570\u636E\u5931\u8D25: ${error.message}`, data: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
function parseCookies3(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  });
  return cookies;
}
__name(parseCookies3, "parseCookies3");
__name2(parseCookies3, "parseCookies");
async function getAuthenticatedUser2(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies3(cookieHeader);
  const token = cookies["auth_token"];
  if (!token) return null;
  const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
  return await verifyJWT(token, jwtSecret);
}
__name(getAuthenticatedUser2, "getAuthenticatedUser2");
__name2(getAuthenticatedUser2, "getAuthenticatedUser");
async function onRequestGet4(context) {
  try {
    const user = await getAuthenticatedUser2(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    try {
      await env.DB.prepare("ALTER TABLE user_funds ADD COLUMN amount REAL DEFAULT 0").run();
    } catch (e) {
    }
    const rows = await env.DB.prepare(
      "SELECT id, code, name, sector, quote_source, holding_start_date, bootstrap_shares_from_amount, shares, cost_amount, amount, created_at FROM user_funds WHERE user_id = ?"
    ).bind(user.id).all();
    const funds = (rows.results || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      sector: row.sector,
      quoteSource: row.quote_source,
      holdingStartDate: row.holding_start_date,
      bootstrapSharesFromAmount: Boolean(row.bootstrap_shares_from_amount),
      shares: Number(row.shares || 0),
      costAmount: Number(row.cost_amount || 0),
      amount: Number(row.amount || 0),
      createdAt: row.created_at
    }));
    return apiResponse({ success: true, funds });
  } catch (error) {
    return apiResponse({ error: `\u62C9\u53D6\u81EA\u9009\u57FA\u91D1\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestGet4, "onRequestGet4");
__name2(onRequestGet4, "onRequestGet");
async function onRequestPost4(context) {
  try {
    const user = await getAuthenticatedUser2(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const payload = await request.json();
    if (!payload.code) {
      return apiResponse({ error: "\u57FA\u91D1\u4EE3\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    }
    const id = payload.id ? String(payload.id) : `uf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const code = String(payload.code).trim();
    const name = payload.name ? String(payload.name).trim() : "\u672A\u547D\u540D\u57FA\u91D1";
    const sector = payload.sector ? String(payload.sector).trim() : "\u672A\u5206\u7EC4";
    const quoteSource = payload.quoteSource || "auto";
    const holdingStartDate = payload.holdingStartDate || "";
    const bootstrapShares = payload.bootstrapSharesFromAmount ? 1 : 0;
    const shares = Number(payload.shares || 0);
    const costAmount = Number(payload.costAmount || 0);
    const amount = Number(payload.amount || 0);
    await env.DB.prepare(`
      INSERT INTO user_funds (id, user_id, code, name, sector, quote_source, holding_start_date, bootstrap_shares_from_amount, shares, cost_amount, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, code) DO UPDATE SET
        name = excluded.name,
        sector = excluded.sector,
        quote_source = excluded.quote_source,
        holding_start_date = excluded.holding_start_date,
        bootstrap_shares_from_amount = excluded.bootstrap_shares_from_amount,
        shares = excluded.shares,
        cost_amount = excluded.cost_amount,
        amount = excluded.amount
    `).bind(id, user.id, code, name, sector, quoteSource, holdingStartDate, bootstrapShares, shares, costAmount, amount).run();
    return apiResponse({ success: true, message: "\u540C\u6B65\u57FA\u91D1\u6210\u529F", id });
  } catch (error) {
    return apiResponse({ error: `\u4FDD\u5B58\u81EA\u9009\u57FA\u91D1\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
async function onRequestDelete(context) {
  try {
    const user = await getAuthenticatedUser2(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return apiResponse({ error: "\u57FA\u91D1\u4EE3\u7801\u7F3A\u5931" }, 400);
    }
    await env.DB.prepare(
      "DELETE FROM user_funds WHERE user_id = ? AND code = ?"
    ).bind(user.id, code).run();
    try {
      await env.DB.prepare(
        "DELETE FROM user_fund_daily_profits WHERE user_id = ? AND fund_code = ?"
      ).bind(user.id, code).run();
    } catch (err) {
      console.warn("\u6E05\u9664\u6536\u76CA\u8BB0\u5F55\u5931\u8D25(\u53EF\u80FD\u8868\u5C1A\u672A\u521B\u5EFA):", err.message);
    }
    return apiResponse({ success: true, message: "\u5220\u9664\u81EA\u9009\u57FA\u91D1\u6210\u529F" });
  } catch (error) {
    return apiResponse({ error: `\u5220\u9664\u81EA\u9009\u57FA\u91D1\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
var INDICES = [
  { symbol: "000001.SS", name: "\u4E0A\u8BC1\u7EFC\u5408\u6307\u6570", englishName: "Shanghai Composite", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "399001.SZ", name: "\u6DF1\u8BC1\u6210\u4EFD\u6307\u6570", englishName: "Shenzhen Component", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "000300.SS", name: "\u6CAA\u6DF1300\u6307\u6570", englishName: "CSI 300 Index", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "399006.SZ", name: "\u521B\u4E1A\u677F\u6307\u6570", englishName: "ChiNext Index", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "000688.SS", name: "\u79D1\u521B50\u6307\u6570", englishName: "SSE STAR 50", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "000905.SS", name: "\u4E2D\u8BC1500\u6307\u6570", englishName: "CSI 500 Index", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "000016.SS", name: "\u4E0A\u8BC150\u6307\u6570", englishName: "SSE 50 Index", region: "CN", regionName: "\u4E2D\u56FD" },
  { symbol: "^HSI", name: "\u6052\u751F\u6307\u6570", englishName: "Hang Seng Index", region: "HK", regionName: "\u4E2D\u56FD\u9999\u6E2F" },
  { symbol: "^HSTECH", name: "\u6052\u751F\u79D1\u6280\u6307\u6570", englishName: "Hang Seng Tech", region: "HK", regionName: "\u4E2D\u56FD\u9999\u6E2F" },
  { symbol: "^GSPC", name: "\u6807\u666E500\u6307\u6570", englishName: "S&P 500", region: "US", regionName: "\u7F8E\u56FD" },
  { symbol: "^IXIC", name: "\u7EB3\u65AF\u8FBE\u514B\u6307\u6570", englishName: "NASDAQ", region: "US", regionName: "\u7F8E\u56FD" },
  { symbol: "^DJI", name: "\u9053\u743C\u65AF\u6307\u6570", englishName: "Dow Jones", region: "US", regionName: "\u7F8E\u56FD" },
  { symbol: "^N225", name: "\u65E5\u7ECF225\u6307\u6570", englishName: "Nikkei 225", region: "JP", regionName: "\u65E5\u672C" },
  { symbol: "^FTSE", name: "\u5BCC\u65F6100\u6307\u6570", englishName: "FTSE 100", region: "UK", regionName: "\u82F1\u56FD" },
  { symbol: "^GDAXI", name: "\u5FB7\u56FDDAX30\u6307\u6570", englishName: "DAX Index", region: "DE", regionName: "\u5FB7\u56FD" },
  { symbol: "GC=F", name: "\u7EBD\u7EA6\u9EC4\u91D1\u73B0\u8D27", englishName: "Gold Spot", region: "CMD", regionName: "\u{1FA99} \u9EC4\u91D1" },
  { symbol: "CL=F", name: "WTI\u539F\u6CB9\u671F\u8D27", englishName: "WTI Crude Oil", region: "CMD", regionName: "\u{1F6E2}\uFE0F \u539F\u6CB9" },
  { symbol: "BTC-USD", name: "\u6BD4\u7279\u5E01\u73B0\u8D27", englishName: "Bitcoin USD", region: "CRP", regionName: "\u20BF \u52A0\u5BC6" },
  { symbol: "CN=F", name: "\u5BCC\u65F6\u4E2D\u56FDA50\u671F\u6307", englishName: "FTSE China A50 Futures", region: "FUT", regionName: "\u671F\u8D27", isLeading: true },
  { symbol: "NQ=F", name: "\u7EB3\u65AF\u8FBE\u514B100\u671F\u6307", englishName: "Nasdaq 100 Futures", region: "FUT", regionName: "\u671F\u8D27", isLeading: true },
  { symbol: "ES=F", name: "\u6807\u8C31500\u671F\u6307", englishName: "S&P 500 Futures", region: "FUT", regionName: "\u671F\u8D27", isLeading: true },
  { symbol: "^HXC", name: "\u7EB3\u65AF\u8FBE\u514B\u91D1\u9F99\u4E2D\u56FD\u6307\u6570", englishName: "Nasdaq Golden Dragon", region: "US", regionName: "\u7F8E\u56FD", isLeading: true },
  { symbol: "USDCNH=X", name: "\u79BB\u5CB8\u4EBA\u6C11\u5E01\u6C47\u7387", englishName: "USD/CNH Exchange Rate", region: "FX", regionName: "\u5916\u6C47", isLeading: true }
];
var BASE_CONFIGS = {
  "^GSPC": { base: 5304.72, drift: 3e-4, volatility: 85e-4 },
  "^IXIC": { base: 16920.72, drift: 5e-4, volatility: 0.0125 },
  "^DJI": { base: 39069.59, drift: 2e-4, volatility: 7e-3 },
  "000001.SS": { base: 3088.53, drift: -1e-4, volatility: 9e-3 },
  "399001.SZ": { base: 9370.84, drift: -1e-4, volatility: 0.012 },
  "000300.SS": { base: 3601.48, drift: -1e-4, volatility: 0.01 },
  "399006.SZ": { base: 1805.2, drift: -1e-4, volatility: 0.0145 },
  "000688.SS": { base: 745.6, drift: -1e-4, volatility: 0.0165 },
  "000905.SS": { base: 5320.1, drift: -1e-4, volatility: 0.0115 },
  "000016.SS": { base: 2420.5, drift: -1e-4, volatility: 85e-4 },
  "^HSI": { base: 18608.94, drift: 1e-4, volatility: 0.013 },
  "^HSTECH": { base: 3820.3, drift: 1e-4, volatility: 0.0185 },
  "^N225": { base: 38610.11, drift: 4e-4, volatility: 0.0105 },
  "^FTSE": { base: 8317.59, drift: 2e-4, volatility: 65e-4 },
  "^GDAXI": { base: 18693.37, drift: 3e-4, volatility: 8e-3 },
  "GC=F": { base: 2355.2, drift: 2e-4, volatility: 6e-3 },
  "CL=F": { base: 78.45, drift: 1e-4, volatility: 0.0155 },
  "BTC-USD": { base: 68500, drift: 8e-4, volatility: 0.032 },
  "CN=F": { base: 12200, drift: 1e-4, volatility: 65e-4 },
  "NQ=F": { base: 18800, drift: 4e-4, volatility: 7e-3 },
  "ES=F": { base: 5310, drift: 3e-4, volatility: 8e-3 },
  "^HXC": { base: 6200, drift: 2e-4, volatility: 0.011 },
  "USDCNH=X": { base: 7.25, drift: -5e-5, volatility: 15e-4 },
  "512480.SS": { base: 1.25, drift: 1e-4, volatility: 0.015 },
  "512690.SS": { base: 0.85, drift: 1e-4, volatility: 0.01 },
  "512170.SS": { base: 0.38, drift: 1e-4, volatility: 0.012 },
  "515790.SS": { base: 0.98, drift: 1e-4, volatility: 0.016 },
  "512880.SS": { base: 0.92, drift: 1e-4, volatility: 0.018 },
  "512660.SS": { base: 1.35, drift: 1e-4, volatility: 0.013 },
  "512800.SS": { base: 1.15, drift: 1e-4, volatility: 8e-3 },
  "515060.SS": { base: 0.65, drift: 1e-4, volatility: 0.0195 },
  "515980.SS": { base: 0.82, drift: 1e-4, volatility: 0.0165 },
  "515220.SS": { base: 1.45, drift: 1e-4, volatility: 0.011 }
};
function getMarketSchedule(symbol) {
  if (["000001.SS", "399001.SZ", "000300.SS", "399006.SZ", "000688.SS", "000905.SS", "000016.SS"].includes(symbol) || symbol.endsWith(".SS") || symbol.endsWith(".SZ")) {
    return {
      timeZone: "Asia/Shanghai",
      sessions: [
        { start: "09:30", end: "11:31" },
        { start: "13:00", end: "15:02" }
      ]
    };
  }
  if (["^HSI", "^HSTECH"].includes(symbol)) {
    return {
      timeZone: "Asia/Hong_Kong",
      sessions: [
        { start: "09:30", end: "12:02" },
        { start: "13:00", end: "16:10" }
      ]
    };
  }
  if (["^GSPC", "^IXIC", "^DJI", "^HXC"].includes(symbol)) {
    return {
      timeZone: "America/New_York",
      sessions: [
        { start: "09:30", end: "16:05" }
      ]
    };
  }
  if (symbol === "^N225") {
    return {
      timeZone: "Asia/Tokyo",
      sessions: [
        { start: "09:00", end: "11:32" },
        { start: "12:30", end: "15:05" }
      ]
    };
  }
  if (symbol === "^FTSE") {
    return {
      timeZone: "Europe/London",
      sessions: [
        { start: "08:00", end: "16:35" }
      ]
    };
  }
  if (symbol === "^GDAXI") {
    return {
      timeZone: "Europe/Berlin",
      sessions: [
        { start: "09:00", end: "17:35" }
      ]
    };
  }
  return {
    timeZone: "UTC",
    sessions: [
      { start: "00:00", end: "24:00" }
    ]
  };
}
__name(getMarketSchedule, "getMarketSchedule");
__name2(getMarketSchedule, "getMarketSchedule");
function isWithinTradingSessions(timestampMs, schedule) {
  if (schedule.timeZone === "UTC" && schedule.sessions[0].start === "00:00" && schedule.sessions[0].end === "24:00") {
    return true;
  }
  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  let weekday = "";
  let hour = "";
  let minute = "";
  for (const part of parts) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "hour") hour = part.value;
    if (part.type === "minute") minute = part.value;
  }
  const timeStr = `${hour}:${minute}`;
  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }
  for (const session of schedule.sessions) {
    if (timeStr >= session.start && timeStr <= session.end) {
      return true;
    }
  }
  return false;
}
__name(isWithinTradingSessions, "isWithinTradingSessions");
__name2(isWithinTradingSessions, "isWithinTradingSessions");
function generateIntradayTimestamps(symbol, count = 78, intervalMinutes = 5) {
  const schedule = getMarketSchedule(symbol);
  const timestamps = [];
  let curr = Date.now();
  let safetyLoop = 0;
  while (!isWithinTradingSessions(curr, schedule) && safetyLoop < 1e4) {
    curr -= 60 * 1e3;
    safetyLoop++;
  }
  curr = Math.floor(curr / (intervalMinutes * 60 * 1e3)) * (intervalMinutes * 60 * 1e3);
  safetyLoop = 0;
  while (timestamps.length < count && safetyLoop < 2e4) {
    if (isWithinTradingSessions(curr, schedule)) {
      timestamps.push(Math.floor(curr / 1e3));
    }
    curr -= intervalMinutes * 60 * 1e3;
    safetyLoop++;
  }
  return timestamps.reverse();
}
__name(generateIntradayTimestamps, "generateIntradayTimestamps");
__name2(generateIntradayTimestamps, "generateIntradayTimestamps");
var TENCENT_SYMBOL_MAP = {
  "000001.SS": "sh000001",
  "399001.SZ": "sz399001",
  "000300.SS": "sh000300",
  "399006.SZ": "sz399006",
  "000688.SS": "sh000688",
  "000905.SS": "sh000905",
  "000016.SS": "sh000016",
  "^HSI": "hkHSI",
  "515790.SS": "sh515790",
  "512880.SS": "sh512880",
  "512660.SS": "sh512660",
  "512800.SS": "sh512800",
  "515060.SS": "sh515060",
  "515980.SS": "sh515980",
  "515220.SS": "sh515220"
};
function parseTencentMinuteData(json, symbolCode, matchName) {
  const codeData = json?.data?.[symbolCode];
  if (!codeData || !codeData.data || !Array.isArray(codeData.data.data)) {
    throw new Error("Invalid Tencent minute response");
  }
  const dateStr = codeData.data.date;
  const points = codeData.data.data;
  const history = [];
  const closes = [];
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const baseDateStr = `${year}-${month}-${day}`;
  for (const pt of points) {
    const parts = pt.split(" ");
    if (parts.length < 2) continue;
    const timeHHMM = parts[0];
    const price = parseFloat(parts[1]);
    if (isNaN(price)) continue;
    const hour = timeHHMM.slice(0, 2);
    const minute = timeHHMM.slice(2, 4);
    const localDate = /* @__PURE__ */ new Date(`${baseDateStr}T${hour}:${minute}:00+08:00`);
    history.push({
      date: localDate.toISOString(),
      time: `${hour}:${minute}`,
      value: price
    });
    closes.push(price);
  }
  const qtInfo = codeData.qt?.[symbolCode] || [];
  const currentPrice = parseFloat(qtInfo[3]) || closes[closes.length - 1] || 0;
  const change = parseFloat(qtInfo[31]) || currentPrice - (closes[0] || currentPrice) || 0;
  const changePercent = parseFloat(qtInfo[32]) || 0;
  const prevClose = currentPrice - change;
  return {
    success: true,
    symbol: symbolCode,
    name: matchName,
    currentPrice,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    history,
    meta: {
      symbol: symbolCode,
      regularMarketPrice: currentPrice,
      chartPreviousClose: prevClose
    }
  };
}
__name(parseTencentMinuteData, "parseTencentMinuteData");
__name2(parseTencentMinuteData, "parseTencentMinuteData");
function boxMullerRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
__name(boxMullerRandom, "boxMullerRandom");
__name2(boxMullerRandom, "boxMullerRandom");
function generateSimulatedData(symbol, range = "1y", realTimePrice = null, realTimePrevClose = null) {
  const config = BASE_CONFIGS[symbol] || { base: 2e3, drift: 2e-4, volatility: 0.01 };
  let days = 250;
  let intervalMs = 24 * 60 * 60 * 1e3;
  if (range === "1d") {
    days = 78;
    intervalMs = 5 * 60 * 1e3;
  } else if (range === "30d" || range === "1m") {
    days = 30;
  } else if (range === "3m" || range === "3mo") {
    days = 90;
  } else if (range === "6m" || range === "6mo") {
    days = 180;
  } else if (range === "1y") {
    days = 252;
  }
  let timestamps = [];
  const closePrices = [];
  let currentPrice = config.base;
  if (range === "1d") {
    timestamps = generateIntradayTimestamps(symbol, days, 5);
  } else {
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const time = now - i * intervalMs;
      timestamps.push(Math.floor(time / 1e3));
    }
  }
  for (let i = 0; i < days; i++) {
    const rand = boxMullerRandom();
    const vol = range === "1d" ? config.volatility * 0.15 : config.volatility;
    const drift = range === "1d" ? config.drift * 0.15 : config.drift;
    const change = drift + vol * rand;
    currentPrice = currentPrice * (1 + change);
    closePrices.push(Number(currentPrice.toFixed(2)));
  }
  const targetLastPrice = realTimePrice !== null && realTimePrice !== void 0 ? realTimePrice : config.base;
  const lastGeneratedPrice = closePrices[closePrices.length - 1];
  const scaleFactor = targetLastPrice / (lastGeneratedPrice || 1);
  for (let i = 0; i < closePrices.length; i++) {
    closePrices[i] = Number((closePrices[i] * scaleFactor).toFixed(2));
  }
  if (realTimePrice !== null && realTimePrice !== void 0) {
    closePrices[closePrices.length - 1] = realTimePrice;
    if (realTimePrevClose !== null && realTimePrevClose !== void 0 && closePrices.length > 1) {
      closePrices[closePrices.length - 2] = realTimePrevClose;
    }
  }
  const lastPrice = closePrices[closePrices.length - 1];
  const prevClose = closePrices[closePrices.length - 2] || lastPrice * 0.99;
  return {
    timestamp: timestamps,
    indicators: {
      quote: [
        {
          close: closePrices
        }
      ]
    },
    meta: {
      symbol,
      regularMarketPrice: lastPrice,
      chartPreviousClose: prevClose
    }
  };
}
__name(generateSimulatedData, "generateSimulatedData");
__name2(generateSimulatedData, "generateSimulatedData");
function cleanYahooData(result) {
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const cleanCloses = [];
  let lastValidValue = result.meta?.chartPreviousClose || 1e3;
  for (let i = 0; i < closes.length; i++) {
    const val = closes[i];
    if (val !== null && val !== void 0 && !Number.isNaN(val)) {
      lastValidValue = val;
      cleanCloses.push(Number(val.toFixed(2)));
    } else {
      cleanCloses.push(Number(lastValidValue.toFixed(2)));
    }
  }
  return {
    timestamp: timestamps,
    indicators: {
      quote: [
        {
          close: cleanCloses
        }
      ]
    },
    meta: {
      symbol: result.meta?.symbol || "",
      regularMarketPrice: result.meta?.regularMarketPrice || lastValidValue,
      chartPreviousClose: result.meta?.chartPreviousClose || lastValidValue
    }
  };
}
__name(cleanYahooData, "cleanYahooData");
__name2(cleanYahooData, "cleanYahooData");
var SINA_INDEX_MAP = {
  "000001.SS": "s_sh000001",
  "399001.SZ": "s_sz399001",
  "000300.SS": "s_sh000300",
  "399006.SZ": "s_sz399006",
  "000688.SS": "s_sh000688",
  "000905.SS": "s_sh000905",
  "000016.SS": "s_sh000016",
  "^HSI": "rt_hkHSI",
  "^HSTECH": "rt_hkHSTECH",
  "^GSPC": "int_sp500",
  "^IXIC": "int_nasdaq",
  "^DJI": "int_dji",
  "^N225": "int_nikkei",
  "^FTSE": "int_ftse",
  "^GDAXI": "int_dax",
  "GC=F": "hf_GC",
  "CL=F": "hf_CL",
  "CN=F": "hf_CHA50CFD",
  "NQ=F": "hf_NQ",
  "ES=F": "hf_ES",
  "^HXC": "gb_hxc",
  "USDCNH=X": "fx_susdcnh"
};
async function fetchSinaRealtimeForSymbol(symbol) {
  const sinaSym = SINA_INDEX_MAP[symbol];
  if (!sinaSym) return null;
  try {
    const url = `https://hq.sinajs.cn/list=${sinaSym}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://finance.sina.com.cn/"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const text = await response.text();
    const match2 = text.match(/var\s+hq_str_[a-zA-Z0-9_]+\s*=\s*"([^"]*)"/);
    if (!match2 || !match2[1]) return null;
    const dataStr = match2[1];
    const parts = dataStr.split(",");
    if (parts.length < 3) return null;
    let price = 0;
    let change = 0;
    let changePercent = 0;
    let prevClose = 0;
    if (sinaSym.startsWith("s_sh") || sinaSym.startsWith("s_sz")) {
      price = parseFloat(parts[1]);
      change = parseFloat(parts[2]);
      changePercent = parseFloat(parts[3]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("int_")) {
      price = parseFloat(parts[1]);
      change = parseFloat(parts[2]);
      changePercent = parseFloat(parts[3]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("rt_hk")) {
      price = parseFloat(parts[6]);
      change = parseFloat(parts[7]);
      changePercent = parseFloat(parts[8]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("gb_")) {
      price = parseFloat(parts[1]);
      change = parseFloat(parts[4]);
      changePercent = parseFloat(parts[2]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("fx_")) {
      price = parseFloat(parts[1]);
      prevClose = parseFloat(parts[3]);
      change = price - prevClose;
      changePercent = change / prevClose * 105;
      changePercent = Number((change / prevClose * 100).toFixed(4));
    } else if (sinaSym.startsWith("hf_")) {
      price = parseFloat(parts[0]);
      prevClose = parseFloat(parts[7]);
      change = price - prevClose;
      changePercent = Number((change / prevClose * 100).toFixed(4));
    } else {
      return null;
    }
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(prevClose) || prevClose <= 0) return null;
    return {
      price,
      prevClose,
      change,
      changePercent
    };
  } catch (err) {
    console.error(`Sina real-time fetch failed for ${symbol} (${sinaSym}):`, err.message);
    return null;
  }
}
__name(fetchSinaRealtimeForSymbol, "fetchSinaRealtimeForSymbol");
__name2(fetchSinaRealtimeForSymbol, "fetchSinaRealtimeForSymbol");
async function getIndexData(symbol, range = "1y", interval = "1d") {
  let indexResult;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4e3);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://finance.yahoo.com/"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      throw new Error("Empty Yahoo result");
    }
    indexResult = cleanYahooData(result);
    const closes = indexResult.indicators?.quote?.[0]?.close || [];
    if (closes.length <= 5) {
      console.log(`Yahoo returned too few data points (${closes.length}) for ${symbol}. Falling back to high-fidelity simulated historical data with real-time scaling.`);
      const realTimePrice = result.meta?.regularMarketPrice;
      const realTimePrevClose = result.meta?.chartPreviousClose;
      indexResult = generateSimulatedData(symbol, range, realTimePrice, realTimePrevClose);
    }
  } catch (err) {
    console.error(`Failed to fetch ${symbol} from Yahoo Finance: ${err.message}. Using simulated fallback.`);
    indexResult = generateSimulatedData(symbol, range);
  }
  if (SINA_INDEX_MAP[symbol]) {
    const sinaQuote = await fetchSinaRealtimeForSymbol(symbol);
    if (sinaQuote) {
      console.log(`Successfully patched ${symbol} with real-time Sina quote: Price = ${sinaQuote.price}, PrevClose = ${sinaQuote.prevClose}`);
      if (indexResult.meta) {
        indexResult.meta.regularMarketPrice = sinaQuote.price;
        indexResult.meta.chartPreviousClose = sinaQuote.prevClose;
      }
      const closes = indexResult.indicators?.quote?.[0]?.close || [];
      if (closes.length > 0) {
        closes[closes.length - 1] = sinaQuote.price;
      }
      if (closes.length > 1 && symbol !== "USDCNH=X") {
        closes[closes.length - 2] = sinaQuote.prevClose;
      }
    }
  }
  return indexResult;
}
__name(getIndexData, "getIndexData");
__name2(getIndexData, "getIndexData");
async function fetchEastmoneySectors() {
  try {
    const fetchPage = /* @__PURE__ */ __name2(async (page, type = 2) => {
      const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=100&po=1&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:${type}&fields=f12,f14,f2,f3,f4,f62`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://quote.eastmoney.com/"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return json?.data?.diff || [];
    }, "fetchPage");
    const pages = await Promise.all([
      fetchPage(1, 2),
      fetchPage(2, 2),
      fetchPage(1, 3),
      fetchPage(2, 3)
    ]);
    const list = [];
    const seen = /* @__PURE__ */ new Set();
    pages.flat().forEach((item) => {
      if (item && item.f12 && item.f14 && !seen.has(item.f12)) {
        seen.add(item.f12);
        list.push(item);
      }
    });
    if (list.length === 0) {
      throw new Error("Fetched list is empty");
    }
    const now = Date.now();
    return list.map((item) => {
      const rawPrice = parseFloat(item.f2);
      const price = isNaN(rawPrice) ? 0 : rawPrice / 100;
      const changePercent = (parseFloat(item.f3) || 0) / 100;
      const change = parseFloat(item.f4) / 100 || 0;
      const netInflow = parseFloat(item.f62) || 0;
      const sparkline = [];
      const points = 30;
      const baseChangePerDay = changePercent / points;
      for (let i = points - 1; i >= 0; i--) {
        const dateStr = new Date(now - i * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
        const noise = (Math.random() - 0.5) * (price * 8e-3);
        const reconstructedPrice = price * (1 - baseChangePerDay * i / 100) + noise;
        sparkline.push({
          date: dateStr,
          value: Number(reconstructedPrice.toFixed(2))
        });
      }
      return {
        symbol: item.f12,
        name: item.f14,
        englishName: item.f12,
        region: "SEC",
        regionName: "\u884C\u4E1A\u677F\u5757",
        currentPrice: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        sparkline,
        netInflow
      };
    });
  } catch (err) {
    console.error("Failed to fetch Eastmoney sectors:", err.message);
    const fallbackSectors = [
      { code: "BK1128", name: "CPO\u6982\u5FF5", baseChange: -4.5 },
      { code: "BK1130", name: "\u7B97\u529B\u6982\u5FF5", baseChange: -5.2 },
      { code: "BK1340", name: "\u5370\u5236\u7535\u8DEF\u677F", baseChange: -1.89 },
      { code: "BK0448", name: "\u901A\u4FE1\u8BBE\u5907", baseChange: -3.18 },
      { code: "BK1036", name: "\u534A\u5BFC\u4F53", baseChange: -6.4 },
      { code: "BK1201", name: "\u7535\u5B50\u5143\u4EF6", baseChange: -2.39 },
      { code: "BK0996", name: "\u8BA1\u7B97\u673A\u8BBE\u5907", baseChange: -1.85 },
      { code: "BK0447", name: "\u8F6F\u4EF6\u5F00\u53D1", baseChange: -1.56 },
      { code: "BK0896", name: "\u8BC1\u5238", baseChange: 0.69 },
      { code: "BK0424", name: "\u917F\u9152\u884C\u4E1A", baseChange: 1.25 },
      { code: "BK0450", name: "\u7535\u529B\u8BBE\u5907", baseChange: 0.88 },
      { code: "BK0465", name: "\u5316\u5B66\u5236\u836F", baseChange: -1.2 },
      { code: "BK0422", name: "\u6C7D\u8F66\u6574\u8F66", baseChange: 0.45 },
      { code: "BK0425", name: "\u822A\u5929\u822A\u7A7A", baseChange: -2.1 },
      { code: "BK0437", name: "\u7164\u70AD\u884C\u4E1A", baseChange: 1.85 },
      { code: "BK0478", name: "\u94F6\u884C", baseChange: 0.22 },
      { code: "BK0451", name: "\u623F\u5730\u4EA7\u5F00\u53D1", baseChange: 0.68 },
      { code: "BK0475", name: "\u6709\u8272\u91D1\u5C5E", baseChange: -0.95 },
      { code: "BK0480", name: "\u751F\u7269\u5236\u54C1", baseChange: -1.5 },
      { code: "BK0427", name: "\u5546\u4E1A\u767E\u8D27", baseChange: 4.13 },
      { code: "BK0479", name: "\u533B\u836F\u5546\u4E1A", baseChange: -0.85 },
      { code: "BK0433", name: "\u5149\u4F0F\u8BBE\u5907", baseChange: 0.92 }
    ];
    const now = Date.now();
    return fallbackSectors.map((item) => {
      const dailyNoise = (Math.random() - 0.5) * 0.4;
      const changePercent = Number((item.baseChange + dailyNoise).toFixed(2));
      const price = 800 + Math.random() * 2e3;
      const inflowNoise = Math.random() * 15e7;
      const netInflow = Math.round((changePercent >= 0 ? 1 : -1) * (2e7 + Math.abs(changePercent) * 4e7) + (Math.random() - 0.5) * inflowNoise);
      const sparkline = [];
      const points = 30;
      const baseChangePerDay = changePercent / points;
      for (let i = points - 1; i >= 0; i--) {
        const dateStr = new Date(now - i * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
        const noise = (Math.random() - 0.5) * (price * 8e-3);
        const reconstructedPrice = price * (1 - baseChangePerDay * i / 100) + noise;
        sparkline.push({
          date: dateStr,
          value: Number(reconstructedPrice.toFixed(2))
        });
      }
      return {
        symbol: item.code,
        name: item.name,
        englishName: item.code,
        region: "SEC",
        regionName: "\u884C\u4E1A\u677F\u5757",
        currentPrice: Number(price.toFixed(2)),
        change: Number((price * changePercent / 100).toFixed(2)),
        changePercent,
        sparkline,
        netInflow
      };
    });
  }
}
__name(fetchEastmoneySectors, "fetchEastmoneySectors");
__name2(fetchEastmoneySectors, "fetchEastmoneySectors");
async function onRequestGet5(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");
    const range = url.searchParams.get("range") || "1y";
    if (symbol) {
      const isEastmoneySector = symbol.startsWith("BK");
      let match2 = INDICES.find((idx) => idx.symbol === symbol);
      if (!match2 && !isEastmoneySector) {
        return new Response(
          JSON.stringify({ error: "Unsupported stock index symbol" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (isEastmoneySector) {
        try {
          const namePromise = fetch(`https://push2.eastmoney.com/api/qt/stock/get?secid=90.${symbol}&fields=f58,f43,f60`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://quote.eastmoney.com/"
            }
          }).then((r) => r.json()).catch(() => null);
          let detailPromise;
          if (range === "1d") {
            detailPromise = fetch(`https://push2his.eastmoney.com/api/qt/stock/trends/get?secid=90.${symbol}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58`, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://quote.eastmoney.com/"
              }
            }).then((r) => r.json()).catch(() => null);
          } else {
            detailPromise = fetch(`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${symbol}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=120`, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://quote.eastmoney.com/"
              }
            }).then((r) => r.json()).catch(() => null);
          }
          const [nameRes, detailRes] = await Promise.all([namePromise, detailPromise]);
          const sectorName = nameRes?.data?.f58 || symbol;
          const currentPrice2 = nameRes?.data?.f43 ? parseFloat(nameRes.data.f43) / 1e3 : 0;
          const prevClose2 = nameRes?.data?.f60 ? parseFloat(nameRes.data.f60) / 1e3 : currentPrice2;
          const history2 = [];
          if (range === "1d") {
            const trends = detailRes?.data || [];
            for (const pt of trends) {
              const timeHHMMStr = pt.f2.toString();
              const price = parseFloat(pt.f3) / 1e3;
              if (isNaN(price)) continue;
              const year = "20" + timeHHMMStr.slice(0, 2);
              const month = timeHHMMStr.slice(2, 4);
              const day = timeHHMMStr.slice(4, 6);
              const hour = timeHHMMStr.slice(6, 8);
              const minute = timeHHMMStr.slice(8, 10);
              const localDate = /* @__PURE__ */ new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`);
              history2.push({
                date: localDate.toISOString(),
                time: `${hour}:${minute}`,
                value: price
              });
            }
          } else {
            const klines = detailRes?.data?.klines || [];
            for (const kl of klines) {
              const parts = kl.split(",");
              if (parts.length < 5) continue;
              const date = parts[0];
              const value = parseFloat(parts[2]) / 10;
              if (isNaN(value)) continue;
              history2.push({
                date,
                value: Number(value.toFixed(2))
              });
            }
          }
          const change2 = Number((currentPrice2 - prevClose2).toFixed(2));
          const changePercent2 = prevClose2 > 0 ? Number((change2 / prevClose2 * 100).toFixed(2)) : 0;
          return new Response(
            JSON.stringify({
              success: true,
              symbol,
              name: sectorName,
              englishName: symbol,
              regionName: "\u884C\u4E1A\u677F\u5757",
              currentPrice: Number(currentPrice2.toFixed(2)),
              change: change2,
              changePercent: changePercent2,
              history: history2
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60"
              }
            }
          );
        } catch (err) {
          console.error(`Eastmoney dynamic detail load failed for ${symbol}:`, err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load sector detailed quotes" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      let interval = "1d";
      if (range === "1d") interval = "5m";
      const schedule = getMarketSchedule(symbol);
      if (range === "1d" && TENCENT_SYMBOL_MAP[symbol]) {
        const tenCode = TENCENT_SYMBOL_MAP[symbol];
        try {
          const res = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${tenCode}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://finance.sina.com.cn/"
            }
          });
          if (res.ok) {
            const json = await res.json();
            const parsed = parseTencentMinuteData(json, tenCode, match2.name);
            if (parsed.history.length > 0) {
              const now = Date.now();
              if (isWithinTradingSessions(now, schedule)) {
                const nowDate = new Date(now);
                parsed.history[parsed.history.length - 1].date = nowDate.toISOString();
                const localFormatter = new Intl.DateTimeFormat("en-US", {
                  timeZone: schedule.timeZone || "Asia/Shanghai",
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit"
                });
                const parts = localFormatter.formatToParts(nowDate);
                let hour = "00";
                let minute = "00";
                for (const part of parts) {
                  if (part.type === "hour") hour = part.value;
                  if (part.type === "minute") minute = part.value;
                }
                parsed.history[parsed.history.length - 1].time = `${hour}:${minute}`;
              }
            }
            return new Response(
              JSON.stringify(parsed),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=30"
                  // Cache for 30 seconds
                }
              }
            );
          }
        } catch (err) {
          console.error(`Failed to fetch from Tencent for ${symbol}: ${err.message}. Falling back to Yahoo Finance.`);
        }
      }
      const indexResult = await getIndexData(symbol, range, interval);
      const timestamps = indexResult.timestamp || [];
      const closes = indexResult.indicators?.quote?.[0]?.close || [];
      let history = [];
      const shiftSeconds = range === "1d" ? 30 * 60 : 0;
      for (let i = 0; i < timestamps.length; i++) {
        const timestampMs = (timestamps[i] + shiftSeconds) * 1e3;
        if (range === "1d" && !isWithinTradingSessions(timestampMs, schedule)) {
          continue;
        }
        const d = new Date(timestampMs);
        const dateStr = range === "1d" ? d.toISOString() : d.toISOString().split("T")[0];
        let timeStr = null;
        if (range === "1d") {
          const localFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: schedule.timeZone,
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
          });
          const parts = localFormatter.formatToParts(d);
          let hour = "00";
          let minute = "00";
          for (const part of parts) {
            if (part.type === "hour") hour = part.value;
            if (part.type === "minute") minute = part.value;
          }
          timeStr = `${hour}:${minute}`;
        }
        history.push({
          date: dateStr,
          time: timeStr,
          value: closes[i]
        });
      }
      if (range === "1d" && history.length > 0) {
        const now = Date.now();
        if (isWithinTradingSessions(now, schedule)) {
          const nowDate = new Date(now);
          history[history.length - 1].date = nowDate.toISOString();
          const localFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: schedule.timeZone,
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
          });
          const parts = localFormatter.formatToParts(nowDate);
          let hour = "00";
          let minute = "00";
          for (const part of parts) {
            if (part.type === "hour") hour = part.value;
            if (part.type === "minute") minute = part.value;
          }
          history[history.length - 1].time = `${hour}:${minute}`;
        }
      }
      const currentPrice = indexResult.meta?.regularMarketPrice || closes[closes.length - 1] || 0;
      const prevClose = range === "1d" || interval === "5m" ? indexResult.meta?.chartPreviousClose || closes[0] || currentPrice : closes.length > 1 ? closes[closes.length - 2] : indexResult.meta?.chartPreviousClose || currentPrice;
      const change = Number((currentPrice - prevClose).toFixed(2));
      const changePercent = Number((change / prevClose * 100).toFixed(2));
      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          name: match2.name,
          englishName: match2.englishName,
          regionName: match2.regionName,
          currentPrice,
          change,
          changePercent,
          history
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60"
            // Cache detail requests for 60 seconds
          }
        }
      );
    }
    const results = await Promise.all(
      INDICES.map(async (item) => {
        const indexResult = await getIndexData(item.symbol, "30d", "1d");
        const timestamps = indexResult.timestamp || [];
        const closes = indexResult.indicators?.quote?.[0]?.close || [];
        const sparkline = [];
        for (let i = 0; i < timestamps.length; i++) {
          const d = new Date(timestamps[i] * 1e3);
          const dateStr = d.toISOString().split("T")[0];
          sparkline.push({
            date: dateStr,
            value: closes[i]
          });
        }
        const currentPrice = closes.length > 0 ? closes[closes.length - 1] : indexResult.meta?.regularMarketPrice || 0;
        const prevClose = closes.length > 1 ? closes[closes.length - 2] : indexResult.meta?.chartPreviousClose || currentPrice;
        const change = Number((currentPrice - prevClose).toFixed(2));
        const changePercent = Number((change / prevClose * 100).toFixed(2));
        return {
          symbol: item.symbol,
          name: item.name,
          englishName: item.englishName,
          region: item.region,
          regionName: item.regionName,
          currentPrice,
          change,
          changePercent,
          sparkline
        };
      })
    );
    const emSectors = await fetchEastmoneySectors();
    const finalIndices = [...results, ...emSectors];
    return new Response(
      JSON.stringify({
        success: true,
        indices: finalIndices,
        timestamp: Date.now()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300"
          // Cache overview dashboard for 5 minutes
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Failed to load global market: ${error.message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequestGet5, "onRequestGet5");
__name2(onRequestGet5, "onRequestGet");
async function onRequestPost5(context) {
  try {
    const { request, env } = context;
    let apiKey = request.headers.get("x-gemini-api-key");
    if (!apiKey || !apiKey.trim()) {
      apiKey = env.GEMINI_API_KEY;
    }
    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "\u672A\u914D\u7F6E Gemini API Key\u3002\u8BF7\u5728\u670D\u52A1\u5668\u7AEF\u90E8\u7F72 GEMINI_API_KEY \u73AF\u5883\u53D8\u91CF\uFF0C\u6216\u5728\u4E0A\u4F20\u754C\u9762\u70B9\u51FB\u53F3\u4E0A\u89D2\u8BBE\u7F6E\u56FE\u6807\u586B\u5199\u60A8\u7684\u4E2A\u4EBA API Key\u3002"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    const body = await request.json();
    const { image, mimeType } = body;
    if (!image || !mimeType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "\u65E0\u6548\u7684\u8BF7\u6C42\u53C2\u6570\uFF0C\u7F3A\u5C11\u56FE\u7247\u6570\u636E\u6216 MimeType"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `\u4F60\u662F\u4E00\u4E2A\u9AD8\u7CBE\u5EA6\u7684\u4E2D\u6587\u652F\u4ED8\u5B9D\u57FA\u91D1\u4EA4\u6613\u622A\u56FE\u8BC6\u522B\u52A9\u624B\u3002\u8BF7\u8BC6\u522B\u5E76\u63D0\u53D6\u51FA\u56FE\u7247\u4E2D\u7684\u6240\u6709\u4EA4\u6613\u8BB0\u5F55\uFF08\u53EF\u80FD\u6709\u591A\u7B14\uFF0C\u8BF7\u5B8C\u6574\u4E14\u4E25\u683C\u5730\u63D0\u53D6\uFF09\u3002
\u4F60\u5FC5\u987B\u8BC6\u522B\u5E76\u8F93\u51FA\u4EE5\u4E0B\u4E94\u4E2A\u5B57\u6BB5\uFF1A
- name: \u57FA\u91D1\u540D\u79F0 (\u4F8B\u5982: "\u5E7F\u53D1\u5229\u946B\u7075\u6D3B\u914D\u7F6E\u6DF7\u5408C"\u3002\u5FC5\u987B\u8981\u5305\u542B\u5B8C\u6574\u7684\u57FA\u91D1\u540D\u79F0\uFF0C\u4E0D\u8981\u7F29\u5199\uFF0C\u53BB\u6389\u524D\u9762\u7684'\u57FA\u91D1-'\u7B49\u4FEE\u9970\u6027\u524D\u7F00\u3002\u82E5\u540D\u79F0\u6709\u6362\u884C\uFF0C\u8BF7\u62FC\u63A5\u5B8C\u6574\u3002\u5C3D\u91CF\u8FD8\u539F\u56FE\u4E2D\u7684\u57FA\u91D1\u6B63\u5F0F\u5168\u540D)
- code: \u57FA\u91D1\u516D\u4F4D\u6570\u5B57\u7F16\u53F7 (\u5982\u679C\u56FE\u7247\u4E2D\u80FD\u770B\u5230\u6216\u8005\u80FD\u786E\u5B9A\uFF0C\u8BF7\u8F93\u5165\u3002\u5982\u679C\u4E0D\u80FD\u786E\u5B9A\uFF0C\u4FDD\u7559\u4E3A\u7A7A\u5B57\u7B26\u4E32 "")
- type: \u4EA4\u6613\u7C7B\u578B (\u53EA\u80FD\u662F "\u4E70\u5165" \u6216 "\u5356\u51FA"\u3002\u5982\u679C\u662F\u8F6C\u6362\u8F6C\u5165\u89C6\u4F5C "\u4E70\u5165"\uFF0C\u8F6C\u6362\u8F6C\u51FA\u89C6\u4F5C "\u5356\u51FA"\uFF0C\u7EA2\u5229\u518D\u6295\u89C6\u4F5C "\u4E70\u5165"\uFF0C\u82E5\u662F\u5176\u4ED6\u7C7B\u578B\u6839\u636E\u5176\u4E70\u5165/\u5356\u51FA\u5C5E\u6027\u5F52\u7C7B)
- amount: \u4EA4\u6613\u91D1\u989D (\u6570\u5B57\uFF0C\u4E0D\u5E26\u8D27\u5E01\u7B26\u53F7\u3002\u4F8B\u5982: 100.00\u3002\u8BF7\u683C\u5916\u6CE8\u610F\u8BC6\u522B\u56FE\u7247\u4E2D\u7684\u5C0F\u6570\u70B9\uFF0C\u4E0D\u8981\u6F0F\u6389\uFF0C\u786E\u4FDD\u8BC6\u522B\u7684\u51C6\u786E\u5EA6)
- tradeDate: \u4EA4\u6613\u65F6\u95F4 (\u683C\u5F0F\u5FC5\u987B\u4E3A "YYYY-MM-DD HH:mm:ss"\u3002\u4F8B\u5982: "2023-10-24 15:00:00"\u3002\u5982\u679C\u56FE\u7247\u4E2D\u53EA\u6709\u65E5\u671F\u6CA1\u6709\u65F6\u95F4\uFF0C\u8BF7\u8865\u9F50\u65F6\u95F4\u4E3A "15:00:00"\uFF0C\u4F8B\u5982 "2023-10-24 15:00:00"\u3002\u5982\u679C\u8FDE\u65E5\u671F\u90FD\u6CA1\u6709\uFF0C\u4F7F\u7528\u4ECA\u5929\u7684\u65E5\u671F\u5E76\u4EE5 10:00:00 \u586B\u5145)

\u8BF7\u76F4\u63A5\u8FD4\u56DE\u4E00\u4E2A\u6807\u51C6\u7684 JSON \u6570\u7EC4\uFF0C\u5305\u542B\u6240\u6709\u8BC6\u522B\u5230\u7684\u4EA4\u6613\u8BB0\u5F55\u5BF9\u8C61\uFF0C\u4E0D\u8981\u6709\u4EFB\u4F55 Markdown \u6807\u8BB0\u6216\u5176\u5B83\u6587\u5B57\u8BF4\u660E\u3002\u786E\u4FDD\u8F93\u51FA\u80FD\u88AB JSON.parse \u6210\u529F\u89E3\u6790\u3002\u4F8B\u5982\uFF1A
[{"name": "\u5E7F\u53D1\u5229\u946B\u7075\u6D3B\u914D\u7F6E\u6DF7\u5408C", "code": "002446", "type": "\u4E70\u5165", "amount": "100.00", "tradeDate": "2023-10-24 15:00:00"}]`;
    const geminiRequestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: image
                // Base64 编码的图片数据
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiRequestBody)
    });
    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = {};
      try {
        parsedErr = JSON.parse(errText);
      } catch (e) {
      }
      const errMsg = parsedErr.error?.message || errText || "\u8BF7\u6C42 Gemini API \u5931\u8D25";
      return new Response(
        JSON.stringify({
          success: false,
          error: `Gemini API \u9519\u8BEF: ${errMsg}\u3002 (\u8BF7\u68C0\u67E5 API Key \u7684\u6709\u6548\u6027\u6216\u7F51\u7EDC\u72B6\u51B5)`
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    const resData = await response.json();
    const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Gemini Vision API \u672A\u8FD4\u56DE\u53EF\u89E3\u6790\u7684\u6587\u672C\u5185\u5BB9"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    let transactions = [];
    try {
      transactions = JSON.parse(textOutput.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini output as JSON:", textOutput, parseError);
      const jsonMatch = textOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          transactions = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `\u89E3\u6790 AI \u8FD4\u56DE\u7ED3\u679C\u5931\u8D25\uFF0C\u5185\u5BB9\u683C\u5F0F\u4E0D\u6B63\u786E: ${textOutput}`
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `\u89E3\u6790 AI \u8FD4\u56DE\u7ED3\u679C\u5931\u8D25: ${textOutput}`
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      }
    }
    return new Response(
      JSON.stringify({
        success: true,
        transactions
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `OCR \u8BF7\u6C42\u5904\u7406\u5931\u8D25: ${error.message}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
__name(onRequestPost5, "onRequestPost5");
__name2(onRequestPost5, "onRequestPost");
async function onRequestGet6(context) {
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
    const results = rawDatas.map((item) => ({
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
          "Cache-Control": "public, max-age=86400"
          // Cache results for 24h
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `\u641C\u7D22\u5931\u8D25: ${error.message}`, datas: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
__name(onRequestGet6, "onRequestGet6");
__name2(onRequestGet6, "onRequestGet");
async function onRequestGet7(context) {
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
    const symbols = symbolsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ quotes: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const isFull = url.searchParams.get("full") === "true";
    const qList = symbols.map((sym) => isFull ? sym : `s_${sym}`).join(",");
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
    const text = await res.text();
    const quotes = {};
    const lines = text.split(";").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match2 = line.match(/var\s+v_([a-zA-Z0-9_\.]+)\s*=\s*"([^"]*)"/);
      if (!match2) continue;
      const fullKey = match2[1];
      const symbolKey = fullKey.replace(/^s_/, "").toLowerCase();
      const dataStr = match2[2];
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
          "Cache-Control": "public, max-age=15"
          // Cache quotes for 15 seconds to prevent hammering
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
__name(onRequestGet7, "onRequestGet7");
__name2(onRequestGet7, "onRequestGet");
function parseCookies4(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  });
  return cookies;
}
__name(parseCookies4, "parseCookies4");
__name2(parseCookies4, "parseCookies");
async function getAuthenticatedUser3(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies4(cookieHeader);
  const token = cookies["auth_token"];
  if (!token) return null;
  const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
  return await verifyJWT(token, jwtSecret);
}
__name(getAuthenticatedUser3, "getAuthenticatedUser3");
__name2(getAuthenticatedUser3, "getAuthenticatedUser");
async function onRequestPost6(context) {
  try {
    const user = await getAuthenticatedUser3(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    try {
      await env.DB.prepare("ALTER TABLE user_funds ADD COLUMN amount REAL DEFAULT 0").run();
    } catch (e) {
    }
    const { funds, transactions, dailyProfits } = await request.json();
    const statements = [];
    if (Array.isArray(funds)) {
      const fundStmt = env.DB.prepare(`
        INSERT INTO user_funds (id, user_id, code, name, sector, quote_source, holding_start_date, bootstrap_shares_from_amount, shares, cost_amount, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, code) DO UPDATE SET
          name = excluded.name,
          sector = excluded.sector,
          quote_source = excluded.quote_source,
          holding_start_date = excluded.holding_start_date,
          bootstrap_shares_from_amount = excluded.bootstrap_shares_from_amount,
          shares = excluded.shares,
          cost_amount = excluded.cost_amount,
          amount = excluded.amount
      `);
      for (const fund of funds) {
        if (!fund.code) continue;
        const id = fund.id ? String(fund.id) : `uf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const code = String(fund.code).trim();
        const name = fund.name ? String(fund.name).trim() : "\u672A\u547D\u540D\u57FA\u91D1";
        const sector = fund.sector ? String(fund.sector).trim() : "\u672A\u5206\u7EC4";
        const quoteSource = fund.quoteSource || "auto";
        const holdingStartDate = fund.holdingStartDate || "";
        const bootstrapShares = fund.bootstrapSharesFromAmount ? 1 : 0;
        const shares = Number(fund.shares || 0);
        const costAmount = Number(fund.costAmount || 0);
        const amount = Number(fund.amount || 0);
        statements.push(fundStmt.bind(id, user.id, code, name, sector, quoteSource, holdingStartDate, bootstrapShares, shares, costAmount, amount));
      }
    }
    if (Array.isArray(transactions)) {
      const txStmt = env.DB.prepare(`
        INSERT INTO transactions (id, user_id, fund_code, fund_name, fund_id, type, amount, trade_date, reference_net_value, shares_delta, cost_delta, source, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          fund_code = excluded.fund_code,
          fund_name = excluded.fund_name,
          fund_id = excluded.fund_id,
          type = excluded.type,
          amount = excluded.amount,
          trade_date = excluded.trade_date,
          reference_net_value = excluded.reference_net_value,
          shares_delta = excluded.shares_delta,
          cost_delta = excluded.cost_delta,
          source = excluded.source,
          note = excluded.note
      `);
      for (const tx of transactions) {
        if (!tx.fundCode || !tx.type || tx.amount === void 0 || !tx.tradeDate) continue;
        const id = tx.id ? String(tx.id) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fundCode = String(tx.fundCode).trim();
        const fundName = tx.fundName ? String(tx.fundName).trim() : "";
        const fundId = tx.fundId ? Number(tx.fundId) : null;
        const type = String(tx.type).trim();
        const amount = Number(tx.amount);
        const tradeDate = String(tx.tradeDate).trim();
        const refNetValue = tx.referenceNetValue !== void 0 ? Number(tx.referenceNetValue) : null;
        const sharesDelta = tx.sharesDelta !== void 0 ? Number(tx.sharesDelta) : null;
        const costDelta = tx.costDelta !== void 0 ? Number(tx.costDelta) : null;
        const source = tx.source ? String(tx.source).trim() : "manual-sync";
        const note = tx.note ? String(tx.note).trim() : "";
        const createdAt = tx.createdAt ? Number(tx.createdAt) : Date.now();
        statements.push(txStmt.bind(
          id,
          user.id,
          fundCode,
          fundName,
          fundId,
          type,
          amount,
          tradeDate,
          refNetValue,
          sharesDelta,
          costDelta,
          source,
          note,
          createdAt
        ));
      }
    }
    if (Array.isArray(dailyProfits)) {
      const dpStmt = env.DB.prepare(`
        INSERT INTO user_fund_daily_profits (id, user_id, fund_code, date, daily_profit)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, fund_code, date) DO UPDATE SET
          daily_profit = excluded.daily_profit
      `);
      for (const dp of dailyProfits) {
        if (!dp.fundCode || !dp.date || dp.dailyProfit === void 0) continue;
        const id = dp.id ? String(dp.id) : `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fundCode = String(dp.fundCode).trim();
        const date = String(dp.date).trim();
        const dailyProfit = Number(dp.dailyProfit);
        statements.push(dpStmt.bind(id, user.id, fundCode, date, dailyProfit));
      }
    }
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
    return apiResponse({ success: true, message: `\u6210\u529F\u540C\u6B65 ${funds?.length || 0} \u4E2A\u81EA\u9009\u57FA\u91D1\u3001${transactions?.length || 0} \u6761\u4EA4\u6613\u8BB0\u5F55\u548C ${dailyProfits?.length || 0} \u6761\u6536\u76CA\u5386\u53F2` });
  } catch (error) {
    return apiResponse({ error: `\u6279\u91CF\u540C\u6B65\u6570\u636E\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestPost6, "onRequestPost6");
__name2(onRequestPost6, "onRequestPost");
function parseCookies5(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=");
    if (name) {
      cookies[name.trim()] = valueParts.join("=").trim();
    }
  });
  return cookies;
}
__name(parseCookies5, "parseCookies5");
__name2(parseCookies5, "parseCookies");
async function getAuthenticatedUser4(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies5(cookieHeader);
  const token = cookies["auth_token"];
  if (!token) return null;
  const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
  return await verifyJWT(token, jwtSecret);
}
__name(getAuthenticatedUser4, "getAuthenticatedUser4");
__name2(getAuthenticatedUser4, "getAuthenticatedUser");
async function onRequestGet8(context) {
  try {
    const user = await getAuthenticatedUser4(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const rows = await env.DB.prepare(
      "SELECT id, fund_code, fund_name, fund_id, type, amount, trade_date, reference_net_value, shares_delta, cost_delta, source, note, created_at FROM transactions WHERE user_id = ? ORDER BY trade_date DESC, created_at DESC"
    ).bind(user.id).all();
    const transactions = (rows.results || []).map((row) => ({
      id: row.id,
      fundCode: row.fund_code,
      fundName: row.fund_name,
      fundId: row.fund_id,
      type: row.type,
      amount: row.amount,
      tradeDate: row.trade_date,
      referenceNetValue: row.reference_net_value,
      sharesDelta: row.shares_delta,
      costDelta: row.cost_delta,
      source: row.source,
      note: row.note,
      createdAt: row.created_at
    }));
    return apiResponse({ success: true, transactions });
  } catch (error) {
    return apiResponse({ error: `\u62C9\u53D6\u4EA4\u6613\u660E\u7EC6\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestGet8, "onRequestGet8");
__name2(onRequestGet8, "onRequestGet");
async function onRequestPost7(context) {
  try {
    const user = await getAuthenticatedUser4(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const payload = await request.json();
    if (!payload.fundCode || !payload.type || payload.amount === void 0 || !payload.tradeDate) {
      return apiResponse({ error: "\u5FC5\u586B\u5B57\u6BB5\u7F3A\u5931" }, 400);
    }
    const id = payload.id ? String(payload.id) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fundCode = String(payload.fundCode).trim();
    const fundName = payload.fundName ? String(payload.fundName).trim() : "";
    const fundId = payload.fundId ? Number(payload.fundId) : null;
    const type = String(payload.type).trim();
    const amount = Number(payload.amount);
    const tradeDate = String(payload.tradeDate).trim();
    const refNetValue = payload.referenceNetValue !== void 0 ? Number(payload.referenceNetValue) : null;
    const sharesDelta = payload.sharesDelta !== void 0 ? Number(payload.sharesDelta) : null;
    const costDelta = payload.costDelta !== void 0 ? Number(payload.costDelta) : null;
    const source = payload.source ? String(payload.source).trim() : "manual-sync";
    const note = payload.note ? String(payload.note).trim() : "";
    const createdAt = payload.createdAt ? Number(payload.createdAt) : Date.now();
    await env.DB.prepare(`
      INSERT INTO transactions (id, user_id, fund_code, fund_name, fund_id, type, amount, trade_date, reference_net_value, shares_delta, cost_delta, source, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        fund_code = excluded.fund_code,
        fund_name = excluded.fund_name,
        fund_id = excluded.fund_id,
        type = excluded.type,
        amount = excluded.amount,
        trade_date = excluded.trade_date,
        reference_net_value = excluded.reference_net_value,
        shares_delta = excluded.shares_delta,
        cost_delta = excluded.cost_delta,
        source = excluded.source,
        note = excluded.note
    `).bind(
      id,
      user.id,
      fundCode,
      fundName,
      fundId,
      type,
      amount,
      tradeDate,
      refNetValue,
      sharesDelta,
      costDelta,
      source,
      note,
      createdAt
    ).run();
    return apiResponse({ success: true, message: "\u4EA4\u6613\u8BB0\u5F55\u540C\u6B65\u6210\u529F", id });
  } catch (error) {
    return apiResponse({ error: `\u4FDD\u5B58\u4EA4\u6613\u6D41\u6C34\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestPost7, "onRequestPost7");
__name2(onRequestPost7, "onRequestPost");
async function onRequestDelete2(context) {
  try {
    const user = await getAuthenticatedUser4(context);
    if (!user) {
      return apiResponse({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F" }, 401);
    }
    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "\u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return apiResponse({ error: "\u4EA4\u6613\u8BB0\u5F55ID\u7F3A\u5931" }, 400);
    }
    await env.DB.prepare(
      "DELETE FROM transactions WHERE user_id = ? AND id = ?"
    ).bind(user.id, id).run();
    return apiResponse({ success: true, message: "\u4EA4\u6613\u8BB0\u5F55\u5220\u9664\u6210\u529F" });
  } catch (error) {
    return apiResponse({ error: `\u5220\u9664\u4EA4\u6613\u6D41\u6C34\u5931\u8D25: ${error.message}` }, 500);
  }
}
__name(onRequestDelete2, "onRequestDelete2");
__name2(onRequestDelete2, "onRequestDelete");
var routes = [
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/daily-profits",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/fund-industry",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/funds",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/funds",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/funds",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/market",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/ocr",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/search",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/stock-quotes",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/sync",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/transactions",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/transactions",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/transactions",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// C:/Users/LeDon/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// C:/Users/LeDon/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-bw0R8Y/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// C:/Users/LeDon/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-bw0R8Y/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.14590900533490359.js.map
