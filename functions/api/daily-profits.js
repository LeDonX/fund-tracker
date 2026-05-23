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

// GET /api/daily-profits - List all daily profit records for the user
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
      "SELECT id, fund_code, date, daily_profit FROM user_fund_daily_profits WHERE user_id = ? ORDER BY date DESC"
    ).bind(user.id).all();

    const dailyProfits = (rows.results || []).map(row => ({
      id: row.id,
      fundCode: row.fund_code,
      date: row.date,
      dailyProfit: Number(row.daily_profit || 0)
    }));

    return apiResponse({ success: true, dailyProfits });
  } catch (error) {
    return apiResponse({ error: `拉取每日收益历史失败: ${error.message}` }, 500);
  }
}
