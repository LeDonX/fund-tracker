// Cryptography and Token Utilities for Cloudflare Workers
// Uses Web Crypto API for secure password hashing (PBKDF2) and JWT signatures (HMAC-SHA256)

// Convert bytes to hex string
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert hex string to bytes
export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Generate a cryptographically secure random salt (16 bytes / 128-bit)
export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// PBKDF2 Password Hashing with SHA-256 and 100,000 iterations
export async function hashPassword(password, saltHex) {
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
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    256 // Key length in bits (256 bits = 32 bytes)
  );
  
  return bytesToHex(new Uint8Array(derivedKeyBytes));
}

// Sign a JWT using HMAC-SHA256
export async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  
  // Safe Base64URL encoder
  const toBase64Url = (obj) => {
    const jsonStr = JSON.stringify(obj);
    const binStr = String.fromCharCode(...encoder.encode(jsonStr));
    return btoa(binStr).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  
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
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${tokenInput}.${signatureB64}`;
}

// Verify a JWT using HMAC-SHA256
export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
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
    
    // Decode base64url to bytes
    const fromBase64Url = (str) => {
      const pad = '='.repeat((4 - str.length % 4) % 4);
      const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
      const binStr = atob(base64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return bytes;
    };
    
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
    
    // Check if expired
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

// Helper to standardise JSON API responses
export function apiResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}
