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

// POST /api/sync - Batch sync local localStorage data into cloud D1
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

    // Auto-migrate: ensure amount column exists (safe to run multiple times)
    try {
      await env.DB.prepare("ALTER TABLE user_funds ADD COLUMN amount REAL DEFAULT 0").run();
    } catch (e) {
      // Column already exists — ignore "duplicate column" errors
    }

    const { funds, transactions } = await request.json();
    const statements = [];

    // 1. Prepare batch statements for funds
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
        const name = fund.name ? String(fund.name).trim() : "未命名基金";
        const sector = fund.sector ? String(fund.sector).trim() : "未分组";
        const quoteSource = fund.quoteSource || "auto";
        const holdingStartDate = fund.holdingStartDate || "";
        const bootstrapShares = fund.bootstrapSharesFromAmount ? 1 : 0;
        const shares = Number(fund.shares || 0);
        const costAmount = Number(fund.costAmount || 0);
        const amount = Number(fund.amount || 0);

        statements.push(fundStmt.bind(id, user.id, code, name, sector, quoteSource, holdingStartDate, bootstrapShares, shares, costAmount, amount));
      }
    }

    // 2. Prepare batch statements for transactions
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
        if (!tx.fundCode || !tx.type || tx.amount === undefined || !tx.tradeDate) continue;
        const id = tx.id ? String(tx.id) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fundCode = String(tx.fundCode).trim();
        const fundName = tx.fundName ? String(tx.fundName).trim() : "";
        const fundId = tx.fundId ? Number(tx.fundId) : null;
        const type = String(tx.type).trim();
        const amount = Number(tx.amount);
        const tradeDate = String(tx.tradeDate).trim();
        const refNetValue = tx.referenceNetValue !== undefined ? Number(tx.referenceNetValue) : null;
        const sharesDelta = tx.sharesDelta !== undefined ? Number(tx.sharesDelta) : null;
        const costDelta = tx.costDelta !== undefined ? Number(tx.costDelta) : null;
        const source = tx.source ? String(tx.source).trim() : "manual-sync";
        const note = tx.note ? String(tx.note).trim() : "";
        const createdAt = tx.createdAt ? Number(tx.createdAt) : Date.now();

        statements.push(txStmt.bind(
          id, user.id, fundCode, fundName, fundId, type, amount, tradeDate, refNetValue, sharesDelta, costDelta, source, note, createdAt
        ));
      }
    }

    // 3. Execute batch atomically
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return apiResponse({ success: true, message: `成功同步 ${funds?.length || 0} 个自选基金和 ${transactions?.length || 0} 条交易记录` });
  } catch (error) {
    return apiResponse({ error: `批量同步数据失败: ${error.message}` }, 500);
  }
}
