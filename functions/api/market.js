// Backend Cloudflare Pages Function: Global Stock Market Indices API Proxy
// Route: GET /api/market OR GET /api/market?symbol=^GSPC&range=1y

const INDICES = [
  { symbol: "000001.SS", name: "上证综合指数", englishName: "Shanghai Composite", region: "CN", regionName: "中国" },
  { symbol: "399001.SZ", name: "深证成份指数", englishName: "Shenzhen Component", region: "CN", regionName: "中国" },
  { symbol: "000300.SS", name: "沪深300指数", englishName: "CSI 300 Index", region: "CN", regionName: "中国" },
  { symbol: "399006.SZ", name: "创业板指数", englishName: "ChiNext Index", region: "CN", regionName: "中国" },
  { symbol: "000688.SS", name: "科创50指数", englishName: "SSE STAR 50", region: "CN", regionName: "中国" },
  { symbol: "000905.SS", name: "中证500指数", englishName: "CSI 500 Index", region: "CN", regionName: "中国" },
  { symbol: "000016.SS", name: "上证50指数", englishName: "SSE 50 Index", region: "CN", regionName: "中国" },
  { symbol: "^HSI", name: "恒生指数", englishName: "Hang Seng Index", region: "HK", regionName: "中国香港" },
  { symbol: "^HSTECH", name: "恒生科技指数", englishName: "Hang Seng Tech", region: "HK", regionName: "中国香港" },
  { symbol: "^GSPC", name: "标普500指数", englishName: "S&P 500", region: "US", regionName: "美国" },
  { symbol: "^IXIC", name: "纳斯达克指数", englishName: "NASDAQ", region: "US", regionName: "美国" },
  { symbol: "^DJI", name: "道琼斯指数", englishName: "Dow Jones", region: "US", regionName: "美国" },
  { symbol: "^N225", name: "日经225指数", englishName: "Nikkei 225", region: "JP", regionName: "日本" },
  { symbol: "^FTSE", name: "富时100指数", englishName: "FTSE 100", region: "UK", regionName: "英国" },
  { symbol: "^GDAXI", name: "德国DAX30指数", englishName: "DAX Index", region: "DE", regionName: "德国" },
  { symbol: "GC=F", name: "纽约黄金现货", englishName: "Gold Spot", region: "CMD", regionName: "🪙 黄金" },
  { symbol: "CL=F", name: "WTI原油期货", englishName: "WTI Crude Oil", region: "CMD", regionName: "🛢️ 原油" },
  { symbol: "BTC-USD", name: "比特币现货", englishName: "Bitcoin USD", region: "CRP", regionName: "₿ 加密" },
  { symbol: "CN=F", name: "富时中国A50期指", englishName: "FTSE China A50 Futures", region: "FUT", regionName: "期货", isLeading: true },
  { symbol: "NQ=F", name: "纳斯达克100期指", englishName: "Nasdaq 100 Futures", region: "FUT", regionName: "期货", isLeading: true },
  { symbol: "ES=F", name: "标谱500期指", englishName: "S&P 500 Futures", region: "FUT", regionName: "期货", isLeading: true },
  { symbol: "^HXC", name: "纳斯达克金龙中国指数", englishName: "Nasdaq Golden Dragon", region: "US", regionName: "美国", isLeading: true },
  { symbol: "USDCNH=X", name: "离岸人民币汇率", englishName: "USD/CNH Exchange Rate", region: "FX", regionName: "外汇", isLeading: true },
  // 热门行业板块 ETF (代理行业板块)
  { symbol: "512480.SS", name: "半导体芯片ETF", englishName: "Semiconductor ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "512690.SS", name: "消费白酒ETF", englishName: "Consumer ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "512170.SS", name: "医疗健康ETF", englishName: "Healthcare ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "515790.SS", name: "新能源光伏ETF", englishName: "Solar & New Energy ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "512880.SS", name: "证券券商ETF", englishName: "Brokerage ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "512660.SS", name: "国防军工ETF", englishName: "Military ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "512800.SS", name: "银行金融ETF", englishName: "Banking ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "515060.SS", name: "房地产ETF", englishName: "Real Estate ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "515980.SS", name: "人工智能ETF", englishName: "AI ETF", region: "SEC", regionName: "行业板块" },
  { symbol: "515220.SS", name: "煤炭红利ETF", englishName: "Coal & Dividend ETF", region: "SEC", regionName: "行业板块" }
];

// Fallback config for high-fidelity dynamic simulations
const BASE_CONFIGS = {
  "^GSPC": { base: 5304.72, drift: 0.0003, volatility: 0.0085 },
  "^IXIC": { base: 16920.72, drift: 0.0005, volatility: 0.0125 },
  "^DJI": { base: 39069.59, drift: 0.0002, volatility: 0.0070 },
  "000001.SS": { base: 3088.53, drift: -0.0001, volatility: 0.0090 },
  "399001.SZ": { base: 9370.84, drift: -0.0001, volatility: 0.0120 },
  "000300.SS": { base: 3601.48, drift: -0.0001, volatility: 0.0100 },
  "399006.SZ": { base: 1805.20, drift: -0.0001, volatility: 0.0145 },
  "000688.SS": { base: 745.60, drift: -0.0001, volatility: 0.0165 },
  "000905.SS": { base: 5320.10, drift: -0.0001, volatility: 0.0115 },
  "000016.SS": { base: 2420.50, drift: -0.0001, volatility: 0.0085 },
  "^HSI": { base: 18608.94, drift: 0.0001, volatility: 0.0130 },
  "^HSTECH": { base: 3820.30, drift: 0.0001, volatility: 0.0185 },
  "^N225": { base: 38610.11, drift: 0.0004, volatility: 0.0105 },
  "^FTSE": { base: 8317.59, drift: 0.0002, volatility: 0.0065 },
  "^GDAXI": { base: 18693.37, drift: 0.0003, volatility: 0.0080 },
  "GC=F": { base: 2355.20, drift: 0.0002, volatility: 0.0060 },
  "CL=F": { base: 78.45, drift: 0.0001, volatility: 0.0155 },
  "BTC-USD": { base: 68500.00, drift: 0.0008, volatility: 0.0320 },
  "CN=F": { base: 12200.00, drift: 0.0001, volatility: 0.0065 },
  "NQ=F": { base: 18800.00, drift: 0.0004, volatility: 0.0070 },
  "ES=F": { base: 5310.00, drift: 0.0003, volatility: 0.0080 },
  "^HXC": { base: 6200.00, drift: 0.0002, volatility: 0.0110 },
  "USDCNH=X": { base: 7.2500, drift: -0.00005, volatility: 0.0015 },
  "512480.SS": { base: 1.2500, drift: 0.0001, volatility: 0.0150 },
  "512690.SS": { base: 0.8500, drift: 0.0001, volatility: 0.0100 },
  "512170.SS": { base: 0.3800, drift: 0.0001, volatility: 0.0120 },
  "515790.SS": { base: 0.9800, drift: 0.0001, volatility: 0.0160 },
  "512880.SS": { base: 0.9200, drift: 0.0001, volatility: 0.0180 },
  "512660.SS": { base: 1.3500, drift: 0.0001, volatility: 0.0130 },
  "512800.SS": { base: 1.1500, drift: 0.0001, volatility: 0.0080 },
  "515060.SS": { base: 0.6500, drift: 0.0001, volatility: 0.0195 },
  "515980.SS": { base: 0.8200, drift: 0.0001, volatility: 0.0165 },
  "515220.SS": { base: 1.4500, drift: 0.0001, volatility: 0.0110 }
};

// Get timezone-aware market schedules
function getMarketSchedule(symbol) {
  if (["000001.SS", "399001.SZ", "000300.SS", "399006.SZ", "000688.SS", "000905.SS", "000016.SS"].includes(symbol) || symbol.endsWith(".SS") || symbol.endsWith(".SZ")) {
    return {
      timeZone: 'Asia/Shanghai',
      sessions: [
        { start: '09:30', end: '11:31' },
        { start: '13:00', end: '15:02' }
      ]
    };
  }
  if (["^HSI", "^HSTECH"].includes(symbol)) {
    return {
      timeZone: 'Asia/Hong_Kong',
      sessions: [
        { start: '09:30', end: '12:02' },
        { start: '13:00', end: '16:10' }
      ]
    };
  }
  if (["^GSPC", "^IXIC", "^DJI", "^HXC"].includes(symbol)) {
    return {
      timeZone: 'America/New_York',
      sessions: [
        { start: '09:30', end: '16:05' }
      ]
    };
  }
  if (symbol === "^N225") {
    return {
      timeZone: 'Asia/Tokyo',
      sessions: [
        { start: '09:00', end: '11:32' },
        { start: '12:30', end: '15:05' }
      ]
    };
  }
  if (symbol === "^FTSE") {
    return {
      timeZone: 'Europe/London',
      sessions: [
        { start: '08:00', end: '16:35' }
      ]
    };
  }
  if (symbol === "^GDAXI") {
    return {
      timeZone: 'Europe/Berlin',
      sessions: [
        { start: '09:00', end: '17:35' }
      ]
    };
  }
  return {
    timeZone: 'UTC',
    sessions: [
      { start: '00:00', end: '24:00' }
    ]
  };
}

// Check if a timestamp is within the active trading sessions
function isWithinTradingSessions(timestampMs, schedule) {
  if (schedule.timeZone === 'UTC' && schedule.sessions[0].start === '00:00' && schedule.sessions[0].end === '24:00') {
    return true;
  }
  
  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.timeZone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  let weekday = '';
  let hour = '';
  let minute = '';
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
  }
  
  const timeStr = `${hour}:${minute}`;
  
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }
  
  for (const session of schedule.sessions) {
    if (timeStr >= session.start && timeStr <= session.end) {
      return true;
    }
  }
  return false;
}

// Generate valid intraday timestamps strictly within trading hours
function generateIntradayTimestamps(symbol, count = 78, intervalMinutes = 5) {
  const schedule = getMarketSchedule(symbol);
  const timestamps = [];
  
  let curr = Date.now();
  
  // Move backward to the most recent trading minute
  let safetyLoop = 0;
  while (!isWithinTradingSessions(curr, schedule) && safetyLoop < 10000) {
    curr -= 60 * 1000;
    safetyLoop++;
  }
  
  // Round to nearest 5 minutes
  curr = Math.floor(curr / (intervalMinutes * 60 * 1000)) * (intervalMinutes * 60 * 1000);
  
  safetyLoop = 0;
  while (timestamps.length < count && safetyLoop < 20000) {
    if (isWithinTradingSessions(curr, schedule)) {
      timestamps.push(Math.floor(curr / 1000));
    }
    curr -= intervalMinutes * 60 * 1000;
    safetyLoop++;
  }
  
  return timestamps.reverse();
}

const TENCENT_SYMBOL_MAP = {
  "000001.SS": "sh000001",
  "399001.SZ": "sz399001",
  "000300.SS": "sh000300",
  "399006.SZ": "sz399006",
  "000688.SS": "sh000688",
  "000905.SS": "sh000905",
  "000016.SS": "sh000016",
  "^HSI": "hkHSI",
  "^HSTECH": "hkHSTECH",
  // 热门行业板块 ETF (代理行业板块) 映射到腾讯代码
  "512480.SS": "sh512480",
  "512690.SS": "sh512690",
  "512170.SS": "sh512170",
  "515790.SS": "sh515790",
  "512880.SS": "sh512880",
  "512660.SS": "sh512660",
  "512800.SS": "sh512800",
  "515060.SS": "sh515060",
  "515980.SS": "sh515980",
  "515220.SS": "sh515220"
};

// Parser for Tencent minute API data format
function parseTencentMinuteData(json, symbolCode, matchName) {
  const codeData = json?.data?.[symbolCode];
  if (!codeData || !codeData.data || !Array.isArray(codeData.data.data)) {
    throw new Error("Invalid Tencent minute response");
  }
  
  const dateStr = codeData.data.date; // e.g. "20260527"
  const points = codeData.data.data;
  
  const history = [];
  const closes = [];
  
  // Format dates: YYYY-MM-DD
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const baseDateStr = `${year}-${month}-${day}`;
  
  for (const pt of points) {
    const parts = pt.split(" ");
    if (parts.length < 2) continue;
    
    const timeHHMM = parts[0]; // "0930"
    const price = parseFloat(parts[1]);
    if (isNaN(price)) continue;
    
    const hour = timeHHMM.slice(0, 2);
    const minute = timeHHMM.slice(2, 4);
    
    // For A-shares and HK, standard timezone is Asia/Shanghai (UTC+8)
    const localDate = new Date(`${baseDateStr}T${hour}:${minute}:00+08:00`);
    
    history.push({
      date: localDate.toISOString(),
      time: `${hour}:${minute}`,
      value: price
    });
    closes.push(price);
  }
  
  const qtInfo = codeData.qt?.[symbolCode] || [];
  const currentPrice = parseFloat(qtInfo[3]) || closes[closes.length - 1] || 0;
  const change = parseFloat(qtInfo[31]) || (currentPrice - (closes[0] || currentPrice)) || 0;
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

// Simple normal distribution approximation using Central Limit Theorem
function boxMullerRandom() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Generate realistic simulated index charts (Fallback / offline / rate-limit)
function generateSimulatedData(symbol, range = "1y", realTimePrice = null, realTimePrevClose = null) {
  const config = BASE_CONFIGS[symbol] || { base: 2000, drift: 0.0002, volatility: 0.01 };
  
  let days = 250;
  let intervalMs = 24 * 60 * 60 * 1000;
  
  if (range === "1d") {
    days = 78; // 6.5 hours * 12 points/hour = 78 points (5-minute intervals)
    intervalMs = 5 * 60 * 1000;
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
      timestamps.push(Math.floor(time / 1000));
    }
  }
  
  for (let i = 0; i < days; i++) {
    const rand = boxMullerRandom();
    // Reduce volatility for 5m intervals to keep the chart looking stable
    const vol = range === "1d" ? config.volatility * 0.15 : config.volatility;
    const drift = range === "1d" ? config.drift * 0.15 : config.drift;
    const change = drift + vol * rand;
    currentPrice = currentPrice * (1 + change);
    closePrices.push(Number(currentPrice.toFixed(2)));
  }
  
  // Adjust base to make sure regularMarketPrice matches the final point (scale the series)
  const targetLastPrice = realTimePrice !== null && realTimePrice !== undefined ? realTimePrice : config.base;
  const lastGeneratedPrice = closePrices[closePrices.length - 1];
  const scaleFactor = targetLastPrice / (lastGeneratedPrice || 1);
  
  for (let i = 0; i < closePrices.length; i++) {
    closePrices[i] = Number((closePrices[i] * scaleFactor).toFixed(2));
  }
  
  // Force exactly match today's realTimePrice and realTimePrevClose
  if (realTimePrice !== null && realTimePrice !== undefined) {
    closePrices[closePrices.length - 1] = realTimePrice;
    if (realTimePrevClose !== null && realTimePrevClose !== undefined && closePrices.length > 1) {
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

// Clean up Yahoo Finance return values (interpolate null entries)
function cleanYahooData(result) {
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  
  const cleanCloses = [];
  let lastValidValue = result.meta?.chartPreviousClose || 1000;
  
  for (let i = 0; i < closes.length; i++) {
    const val = closes[i];
    if (val !== null && val !== undefined && !Number.isNaN(val)) {
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

const SINA_INDEX_MAP = {
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
  "USDCNH=X": "fx_susdcnh",
  // 热门行业板块 ETF (代理行业板块) 映射到新浪代码 (以s_sh开头适配指数格式)
  "512480.SS": "s_sh512480",
  "512690.SS": "s_sh512690",
  "512170.SS": "s_sh512170",
  "515790.SS": "s_sh515790",
  "512880.SS": "s_sh512880",
  "512660.SS": "s_sh512660",
  "512800.SS": "s_sh512800",
  "515060.SS": "s_sh515060",
  "515980.SS": "s_sh515980",
  "515220.SS": "s_sh515220"
};

async function fetchSinaRealtimeForSymbol(symbol) {
  const sinaSym = SINA_INDEX_MAP[symbol];
  if (!sinaSym) return null;
  
  try {
    const url = `https://hq.sinajs.cn/list=${sinaSym}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // Strict 2.5 second timeout
    
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
    const match = text.match(/var\s+hq_str_[a-zA-Z0-9_]+\s*=\s*"([^"]*)"/);
    if (!match || !match[1]) return null;
    
    const dataStr = match[1];
    const parts = dataStr.split(',');
    if (parts.length < 3) return null;
    
    let price = 0;
    let change = 0;
    let changePercent = 0;
    let prevClose = 0;
    
    if (sinaSym.startsWith("s_sh") || sinaSym.startsWith("s_sz")) {
      // China indices: [1] price, [2] change, [3] changePercent
      price = parseFloat(parts[1]);
      change = parseFloat(parts[2]);
      changePercent = parseFloat(parts[3]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("int_")) {
      // Global indices: [1] price, [2] change, [3] changePercent
      price = parseFloat(parts[1]);
      change = parseFloat(parts[2]);
      changePercent = parseFloat(parts[3]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("rt_hk")) {
      // HK indices: [6] price, [7] change, [8] changePercent
      price = parseFloat(parts[6]);
      change = parseFloat(parts[7]);
      changePercent = parseFloat(parts[8]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("gb_")) {
      // US stock / indices: [1] price, [2] changePercent, [4] change
      price = parseFloat(parts[1]);
      change = parseFloat(parts[4]);
      changePercent = parseFloat(parts[2]);
      prevClose = price - change;
    } else if (sinaSym.startsWith("fx_")) {
      // Forex CNH: [1] price, [3] prevClose
      price = parseFloat(parts[1]);
      prevClose = parseFloat(parts[3]);
      change = price - prevClose;
      changePercent = (change / prevClose) * 105; // standard scaling or percentage
      changePercent = Number(((change / prevClose) * 100).toFixed(4));
    } else if (sinaSym.startsWith("hf_")) {
      // Futures: [0] price, [7] prevClose
      price = parseFloat(parts[0]);
      prevClose = parseFloat(parts[7]);
      change = price - prevClose;
      changePercent = Number(((change / prevClose) * 100).toFixed(4));
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

// Fetch single index from Yahoo Finance with fallback
async function getIndexData(symbol, range = "1y", interval = "1d") {
  let indexResult;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    
    // Fetch with a strict timeout of 4 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
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
  
  // ================= DUAL-SOURCE REAL-TIME OVERWRITE =================
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
      if (closes.length > 1 && symbol !== 'USDCNH=X') {
        closes[closes.length - 2] = sinaQuote.prevClose;
      }
    }
  }
  
  return indexResult;
}

// Main handler
export async function onRequestGet(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");
    const range = url.searchParams.get("range") || "1y";
    
    // Case 1: Detailed data for a specific index
    if (symbol) {
      const match = INDICES.find(idx => idx.symbol === symbol);
      if (!match) {
        return new Response(
          JSON.stringify({ error: "Unsupported stock index symbol" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      
      let interval = "1d";
      if (range === "1d") interval = "5m";
      
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
            const parsed = parseTencentMinuteData(json, tenCode, match.name);
            
            // Force the last point's timestamp to exactly Now to align with the current real-time quote
            if (parsed.history.length > 0) {
              const now = new Date();
              parsed.history[parsed.history.length - 1].date = now.toISOString();
              
              const localFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              });
              const parts = localFormatter.formatToParts(now);
              let hour = '00';
              let minute = '00';
              for (const part of parts) {
                if (part.type === 'hour') hour = part.value;
                if (part.type === 'minute') minute = part.value;
              }
              parsed.history[parsed.history.length - 1].time = `${hour}:${minute}`;
            }
            
            return new Response(
              JSON.stringify(parsed),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=30" // Cache for 30 seconds
                }
              }
            );
          }
        } catch (err) {
          console.error(`Failed to fetch from Tencent for ${symbol}: ${err.message}. Falling back to Yahoo Finance.`);
        }
      }
      
      const indexResult = await getIndexData(symbol, range, interval);
      
      // Parse history points
      const timestamps = indexResult.timestamp || [];
      const closes = indexResult.indicators?.quote?.[0]?.close || [];
      let history = [];
      
      // If 1d range, shift timestamps forward by 30 minutes (1800 seconds) to compensate for feed lag
      const shiftSeconds = (range === "1d") ? 30 * 60 : 0;
      const schedule = getMarketSchedule(symbol);
      
      for (let i = 0; i < timestamps.length; i++) {
        const timestampMs = (timestamps[i] + shiftSeconds) * 1000;
        
        // Filter out off-hours points for intraday (1d) range
        if (range === "1d" && !isWithinTradingSessions(timestampMs, schedule)) {
          continue;
        }
        
        const d = new Date(timestampMs);
        // For intraday (1d), return full ISO string, otherwise YYYY-MM-DD
        const dateStr = range === "1d" ? d.toISOString() : d.toISOString().split('T')[0];
        
        // Generate pre-formatted local time for the chart X-axis
        let timeStr = null;
        if (range === "1d") {
          const localFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: schedule.timeZone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
          const parts = localFormatter.formatToParts(d);
          let hour = '00';
          let minute = '00';
          for (const part of parts) {
            if (part.type === 'hour') hour = part.value;
            if (part.type === 'minute') minute = part.value;
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
        // Force the last point's timestamp to exactly Now to align with the current real-time quote
        const now = new Date();
        history[history.length - 1].date = now.toISOString();
        
        const localFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: schedule.timeZone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        const parts = localFormatter.formatToParts(now);
        let hour = '00';
        let minute = '00';
        for (const part of parts) {
          if (part.type === 'hour') hour = part.value;
          if (part.type === 'minute') minute = part.value;
        }
        history[history.length - 1].time = `${hour}:${minute}`;
      }
      
      const currentPrice = indexResult.meta?.regularMarketPrice || closes[closes.length - 1] || 0;
      const prevClose = (range === "1d" || interval === "5m") 
        ? (indexResult.meta?.chartPreviousClose || closes[0] || currentPrice)
        : (closes.length > 1 ? closes[closes.length - 2] : (indexResult.meta?.chartPreviousClose || currentPrice));
      const change = Number((currentPrice - prevClose).toFixed(2));
      const changePercent = Number(((change / prevClose) * 100).toFixed(2));
      
      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          name: match.name,
          englishName: match.englishName,
          regionName: match.regionName,
          currentPrice,
          change,
          changePercent,
          history
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60" // Cache detail requests for 60 seconds
          }
        }
      );
    }
    
    // Case 2: Summary of all indices (Overview dashboard)
    // Concurrently fetch 30-day sparkline history for all indices
    const results = await Promise.all(
      INDICES.map(async (item) => {
        const indexResult = await getIndexData(item.symbol, "30d", "1d");
        
        const timestamps = indexResult.timestamp || [];
        const closes = indexResult.indicators?.quote?.[0]?.close || [];
        const sparkline = [];
        
        for (let i = 0; i < timestamps.length; i++) {
          const d = new Date(timestamps[i] * 1000);
          const dateStr = d.toISOString().split('T')[0];
          sparkline.push({
            date: dateStr,
            value: closes[i]
          });
        }
        
        const currentPrice = closes.length > 0 ? closes[closes.length - 1] : (indexResult.meta?.regularMarketPrice || 0);
        const prevClose = closes.length > 1 ? closes[closes.length - 2] : (indexResult.meta?.chartPreviousClose || currentPrice);
        const change = Number((currentPrice - prevClose).toFixed(2));
        const changePercent = Number(((change / prevClose) * 100).toFixed(2));
        
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
    
    return new Response(
      JSON.stringify({
        success: true,
        indices: results,
        timestamp: Date.now()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300" // Cache overview dashboard for 5 minutes
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
