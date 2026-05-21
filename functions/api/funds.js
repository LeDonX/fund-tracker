import { verifyJWT, apiResponse } from "./auth/_utils.js";

// Helper to parse cookies
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.split('=');
    if (name) {
      cookies[name.trim()] = valueParts.join('=').trim();
    }
  });
  return cookies;
}

// Authenticate and get user
async function getAuthenticatedUser(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const token = cookies["auth_token"];
  if (!token) return null;
  
  const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
  return await verifyJWT(token, jwtSecret);
}

// GET /api/funds - List tracked funds
export async function onRequestGet(context) {
  try {
    const user = await getAuthenticatedUser(context);
    if (!user) {
      return apiResponse({ error: "未登录或登录会话已过期" }, 401);
    }

    const { env } = context;
    if (!env.DB) {
      return apiResponse({ error: "数据库未绑定" }, 500);
    }

    const rows = await env.DB.prepare(
      "SELECT id, code, name, sector, quote_source, holding_start_date, bootstrap_shares_from_amount, shares, cost_amount, created_at FROM user_funds WHERE user_id = ?"
    ).bind(user.id).all();

    // Map DB fields to frontend format (camelCase)
    const funds = (rows.results || []).map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      sector: row.sector,
      quoteSource: row.quote_source,
      holdingStartDate: row.holding_start_date,
      bootstrapSharesFromAmount: Boolean(row.bootstrap_shares_from_amount),
      shares: Number(row.shares || 0),
      costAmount: Number(row.cost_amount || 0),
      createdAt: row.created_at
    }));

    return apiResponse({ success: true, funds });
  } catch (error) {
    return apiResponse({ error: `拉取自选基金失败: ${error.message}` }, 500);
  }
}

// POST /api/funds - Add or update a tracked fund
export async function onRequestPost(context) {
  try {
    const user = await getAuthenticatedUser(context);
    if (!user) {
      return apiResponse({ error: "未登录或登录会话已过期" }, 401);
    }

    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "数据库未绑定" }, 500);
    }

    const payload = await request.json();
    if (!payload.code) {
      return apiResponse({ error: "基金代码不能为空" }, 400);
    }

    const id = payload.id ? String(payload.id) : `uf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const code = String(payload.code).trim();
    const name = payload.name ? String(payload.name).trim() : "未命名基金";
    const sector = payload.sector ? String(payload.sector).trim() : "未分组";
    const quoteSource = payload.quoteSource || "auto";
    const holdingStartDate = payload.holdingStartDate || "";
    const bootstrapShares = payload.bootstrapSharesFromAmount ? 1 : 0;
    const shares = Number(payload.shares || 0);
    const costAmount = Number(payload.costAmount || 0);

    await env.DB.prepare(`
      INSERT INTO user_funds (id, user_id, code, name, sector, quote_source, holding_start_date, bootstrap_shares_from_amount, shares, cost_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, code) DO UPDATE SET
        name = excluded.name,
        sector = excluded.sector,
        quote_source = excluded.quote_source,
        holding_start_date = excluded.holding_start_date,
        bootstrap_shares_from_amount = excluded.bootstrap_shares_from_amount,
        shares = excluded.shares,
        cost_amount = excluded.cost_amount
    `).bind(id, user.id, code, name, sector, quoteSource, holdingStartDate, bootstrapShares, shares, costAmount).run();

    return apiResponse({ success: true, message: "同步基金成功", id });
  } catch (error) {
    return apiResponse({ error: `保存自选基金失败: ${error.message}` }, 500);
  }
}

// DELETE /api/funds - Untrack a fund
export async function onRequestDelete(context) {
  try {
    const user = await getAuthenticatedUser(context);
    if (!user) {
      return apiResponse({ error: "未登录或登录会话已过期" }, 401);
    }

    const { request, env } = context;
    if (!env.DB) {
      return apiResponse({ error: "数据库未绑定" }, 500);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return apiResponse({ error: "基金代码缺失" }, 400);
    }

    await env.DB.prepare(
      "DELETE FROM user_funds WHERE user_id = ? AND code = ?"
    ).bind(user.id, code).run();

    return apiResponse({ success: true, message: "删除自选基金成功" });
  } catch (error) {
    return apiResponse({ error: `删除自选基金失败: ${error.message}` }, 500);
  }
}
