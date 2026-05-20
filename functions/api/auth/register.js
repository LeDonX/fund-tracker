// Backend Page Function: Register API
// Route: POST /api/auth/register
import { hashPassword, generateSalt, apiResponse } from "./_utils.js";

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
    
    // Simple validation
    if (!email || !password) {
      return apiResponse({ error: "邮箱和密码不能为空" }, 400);
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse({ error: "邮箱格式不正确" }, 400);
    }
    
    if (password.length < 6) {
      return apiResponse({ error: "密码长度必须至少为 6 位" }, 400);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    
    // CHECK 1: Real Cloudflare D1 Database
    if (env.DB) {
      // Check if user already exists
      const existingUser = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(normalizedEmail)
        .first();
        
      if (existingUser) {
        return apiResponse({ error: "该邮箱已被注册" }, 400);
      }
      
      // Insert new user
      await env.DB.prepare("INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)")
        .bind(normalizedEmail, passwordHash, salt)
        .run();
        
      return apiResponse({ message: "注册成功", mode: "D1_DATABASE" }, 201);
    } 
    
    // CHECK 2: Mock Database Fallback (For instant testing without D1)
    else {
      const existingUser = globalThis.__MOCK_USERS_DB.find(u => u.email === normalizedEmail);
      if (existingUser) {
        return apiResponse({ error: "该邮箱已被注册(模拟库)" }, 400);
      }
      
      globalThis.__MOCK_USERS_DB.push({
        id: globalThis.__MOCK_USERS_DB.length + 1,
        email: normalizedEmail,
        password_hash: passwordHash,
        salt: salt,
        created_at: new Date().toISOString()
      });
      
      return apiResponse({ 
        message: "注册成功（运行在未绑定数据库的演示模式中，数据保存在内存中）", 
        mode: "DEMO_MEMORY" 
      }, 201);
    }
  } catch (error) {
    return apiResponse({ error: `服务器内部错误: ${error.message}` }, 500);
  }
}
