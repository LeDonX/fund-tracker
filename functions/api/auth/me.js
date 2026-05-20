// Backend Page Function: Session and Profile API / Logout API
// Route: GET /api/auth/me (Check Session)
// Route: POST /api/auth/me (Logout)
import { verifyJWT, apiResponse } from "./_utils.js";

// Helper to parse cookies from headers
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

// GET Handler: Check if user is currently logged in and return profile
export async function onRequestGet(context) {
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
      return apiResponse({ authenticated: false, error: "未登录" }, 401, cacheHeaders);
    }
    
    const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
    const payload = await verifyJWT(token, jwtSecret);
    
    if (!payload) {
      // Token is invalid or expired -> Clear cookie immediately
      const isSecure = request.url.startsWith("https://");
      const clearCookieString = `auth_token=; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return apiResponse({ authenticated: false, error: "会话过期或无效" }, 401, {
        "Set-Cookie": clearCookieString,
        ...cacheHeaders
      });
    }
    
    const colo = request.cf ? request.cf.colo : null;
    
    // User authenticated successfully
    return apiResponse({
      authenticated: true,
      user: {
        id: payload.id,
        email: payload.email
      },
      colo: colo
    }, 200, cacheHeaders);
    
  } catch (error) {
    return apiResponse({ error: `服务器内部错误: ${error.message}` }, 500);
  }
}

// POST Handler: Logout and clear authentication cookie
export async function onRequestPost(context) {
  try {
    const { request } = context;
    const isSecure = request.url.startsWith("https://");
    // Overwrite cookie with expiration in the past to delete it
    const clearCookieString = `auth_token=; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    
    return apiResponse({
      message: "退出登录成功"
    }, 200, {
      "Set-Cookie": clearCookieString,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
  } catch (error) {
    return apiResponse({ error: `服务器内部错误: ${error.message}` }, 500);
  }
}
