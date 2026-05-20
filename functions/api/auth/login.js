// Backend Page Function: Login API
// Route: POST /api/auth/login
import { hashPassword, signJWT, apiResponse } from "./_utils.js";

// Global in-memory fallback database for demo purposes (when D1 is not bound)
globalThis.__MOCK_USERS_DB = globalThis.__MOCK_USERS_DB || [];

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return apiResponse({ error: "无效的 JSON 请求体" }, 400);
    }
    
    const { email, password } = body;
    
    if (!email || !password) {
      return apiResponse({ error: "邮箱和密码不能为空" }, 400);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    let user = null;
    let isDemoMode = false;
    
    // CHECK 1: Real D1 Database
    if (env.DB) {
      user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(normalizedEmail)
        .first();
    } 
    // CHECK 2: Mock Database Fallback
    else {
      user = globalThis.__MOCK_USERS_DB.find(u => u.email === normalizedEmail);
      isDemoMode = true;
    }
    
    if (!user) {
      return apiResponse({ error: "邮箱或密码错误" }, 401);
    }
    
    // Hash password with user's specific salt and compare
    const passwordHashInput = await hashPassword(password, user.salt);
    
    if (passwordHashInput !== user.password_hash) {
      return apiResponse({ error: "邮箱或密码错误" }, 401);
    }
    
    // Credentials valid -> Sign a JWT session token
    // Expires in 24 hours
    const expiration = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    const payload = {
      id: user.id,
      email: user.email,
      exp: expiration
    };
    
    // Secure token secret fallback for local testing
    const jwtSecret = env.JWT_SECRET || "free-auth-pc-super-secret-key-987654321";
    const jwtToken = await signJWT(payload, jwtSecret);
    
    // Set cookie headers for secure authentication (prevent XSS token extraction)
    const isSecure = request.url.startsWith("https://");
    const cookieString = `auth_token=${jwtToken}; Path=/; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=Lax; Max-Age=86400`;
    const colo = request.cf ? request.cf.colo : null;
    
    return apiResponse({
      message: "登录成功",
      user: {
        id: user.id,
        email: user.email
      },
      demo: isDemoMode,
      colo: colo
    }, 200, {
      "Set-Cookie": cookieString,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    });
    
  } catch (error) {
    return apiResponse({ error: `服务器内部错误: ${error.message}` }, 500);
  }
}
