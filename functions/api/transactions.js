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

// GET /api/transactions - List all user transactions
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
      "SELECT id, fund_code, fund_name, fund_id, type, amount, trade_date, reference_net_value, shares_delta, cost_delta, source, note, created_at FROM transactions WHERE user_id = ? ORDER BY trade_date DESC, created_at DESC"
    ).bind(user.id).all();

    // Map DB fields to frontend format (camelCase)
    const transactions = (rows.results || []).map(row => ({
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
    return apiResponse({ error: `拉取交易明细失败: ${error.message}` }, 500);
  }
}

// POST /api/transactions - Add or update a transaction
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
    if (!payload.fundCode || !payload.type || payload.amount === undefined || !payload.tradeDate) {
      return apiResponse({ error: "必填字段缺失" }, 400);
    }

    const id = payload.id ? String(payload.id) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fundCode = String(payload.fundCode).trim();
    const fundName = payload.fundName ? String(payload.fundName).trim() : "";
    const fundId = payload.fundId ? Number(payload.fundId) : null;
    const type = String(payload.type).trim();
    const amount = Number(payload.amount);
    const tradeDate = String(payload.tradeDate).trim();
    const refNetValue = payload.referenceNetValue !== undefined ? Number(payload.referenceNetValue) : null;
    const sharesDelta = payload.sharesDelta !== undefined ? Number(payload.sharesDelta) : null;
    const costDelta = payload.costDelta !== undefined ? Number(payload.costDelta) : null;
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
      id, user.id, fundCode, fundName, fundId, type, amount, tradeDate, refNetValue, sharesDelta, costDelta, source, note, createdAt
    ).run();

    return apiResponse({ success: true, message: "交易记录同步成功", id });
  } catch (error) {
    return apiResponse({ error: `保存交易流水失败: ${error.message}` }, 500);
  }
}

// DELETE /api/transactions - Delete a transaction
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
    const id = url.searchParams.get("id");

    if (!id) {
      return apiResponse({ error: "交易记录ID缺失" }, 400);
    }

    await env.DB.prepare(
      "DELETE FROM transactions WHERE user_id = ? AND id = ?"
    ).bind(user.id, id).run();

    return apiResponse({ success: true, message: "交易记录删除成功" });
  } catch (error) {
    return apiResponse({ error: `删除交易流水失败: ${error.message}` }, 500);
  }
}
