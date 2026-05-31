import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';

const INDICES_SHORT_NAMES = {
  "000001.SS": "上证指数",
  "399001.SZ": "深证成指",
  "000300.SS": "沪深300",
  "399006.SZ": "创业板指",
  "000688.SS": "科创50",
  "000905.SS": "中证500",
  "000016.SS": "上证50",
  "^HSI": "恒生指数",
  "^HSTECH": "恒生科技",
  "^GSPC": "标普500",
  "^IXIC": "纳斯达克",
  "^DJI": "道琼斯",
  "^N225": "日经225",
  "^FTSE": "富时100",
  "^GDAXI": "德国DAX",
  "GC=F": "伦敦金",
  "CL=F": "美原油",
  "BTC-USD": "比特币",
  "CN=F": "A50期指",
  "NQ=F": "纳指期货",
  "ES=F": "标普期货",
  "^HXC": "中国金龙",
  "USDCNH=X": "离岸汇率"
};

// Helper to generate the full day timeline of "HH:MM" strings for alignment
function getFullDayTimeline(symbol, isOneMinute = false) {
  const cnIndices = ["000001.SS", "399001.SZ", "000300.SS", "399006.SZ", "000688.SS", "000905.SS", "000016.SS"];
  const hkIndices = ["^HSI", "^HSTECH"];
  const usIndices = ["^GSPC", "^IXIC", "^DJI", "^HXC"];
  const jpIndices = ["^N225"];
  const ukIndices = ["^FTSE"];
  const deIndices = ["^GDAXI"];

  const minutes = [];
  const addMinutes = (startH, startM, endH, endM, step) => {
    let h = startH;
    let m = startM;
    while (h < endH || (h === endH && m <= endM)) {
      minutes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += step;
      if (m >= 60) {
        h += Math.floor(m / 60);
        m = m % 60;
      }
    }
  };

  const step = isOneMinute ? 1 : 5;

  if (cnIndices.includes(symbol)) {
    addMinutes(9, 30, 11, 30, step);
    addMinutes(13, 0, 15, 0, step);
    return minutes;
  }
  if (hkIndices.includes(symbol)) {
    addMinutes(9, 30, 12, 0, step);
    addMinutes(13, 0, 16, 0, step);
    return minutes;
  }
  if (usIndices.includes(symbol)) {
    addMinutes(9, 30, 16, 0, step);
    return minutes;
  }
  if (jpIndices.includes(symbol)) {
    addMinutes(9, 0, 11, 30, step);
    addMinutes(12, 30, 15, 0, step);
    return minutes;
  }
  if (ukIndices.includes(symbol)) {
    addMinutes(8, 0, 16, 30, step);
    return minutes;
  }
  if (deIndices.includes(symbol)) {
    addMinutes(9, 0, 17, 30, step);
    return minutes;
  }

  // 24h fallback at 15m intervals
  addMinutes(0, 0, 23, 45, 15);
  return minutes;
}

// Compact SVG sparkline component for sidebar rows
function SidebarSparkline({ data, isPositive, symbol }) {
  if (!data || data.length <= 1) return null;
  
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const width = 240;
  const height = 32;
  const padding = 1;

  const isOneMinute = data.length > 80;
  const fullTimeline = getFullDayTimeline(symbol, isOneMinute);
  
  const points = data.map((d, index) => {
    let x;
    const timeIndex = d.time ? fullTimeline.indexOf(d.time) : -1;
    if (timeIndex !== -1) {
      x = (timeIndex / (fullTimeline.length - 1)) * (width - padding * 2) + padding;
    } else {
      x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    }
    const y = height - ((d.value - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  }).join(' ');
  
  // Chinese stock standard: Rose for up, Emerald for down
  const strokeColor = isPositive ? '#f43f5e' : '#10b981';
  const cleanSym = symbol ? symbol.replace(/[^a-zA-Z0-9]/g, '') : Math.random().toString(36).substr(2, 5);
  const gradId = `sidebar-sparkline-grad-${isPositive ? 'up' : 'down'}-${cleanSym}`;
  
  // Align gradient drop precisely with the start and end of the drawn line
  const firstTimeIndex = data[0]?.time ? fullTimeline.indexOf(data[0].time) : -1;
  const firstX = firstTimeIndex !== -1 ? (firstTimeIndex / (fullTimeline.length - 1)) * (width - padding * 2) + padding : padding;
  
  const lastTimeIndex = data[data.length - 1]?.time ? fullTimeline.indexOf(data[data.length - 1].time) : -1;
  const lastX = lastTimeIndex !== -1 ? (lastTimeIndex / (fullTimeline.length - 1)) * (width - padding * 2) + padding : width - padding;

  const fillPoints = `${firstX},${height} ${points} ${lastX},${height}`;
  
  return (
    <svg className="w-full h-8 overflow-visible pointer-events-none" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? '#f43f5e' : '#10b981'} stopOpacity="0.22" />
          <stop offset="100%" stopColor={isPositive ? '#f43f5e' : '#10b981'} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function SidebarMarketTrends({ setActiveTab }) {
  const [pinnedSymbols, setPinnedSymbols] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebar_market_pinned_symbols');
      const parsed = stored ? JSON.parse(stored) : ['000001.SS', '^IXIC'];
      return Array.isArray(parsed) ? parsed.slice(0, 2) : ['000001.SS', '^IXIC'];
    } catch {
      return ['000001.SS', '^IXIC'];
    }
  });

  const [trendsData, setTrendsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef(null);

  // Fetch trend data for a single symbol
  const fetchTrendData = async (symbol) => {
    try {
      const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&range=1d`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        return {
          symbol,
          name: INDICES_SHORT_NAMES[symbol] || data.name || symbol,
          currentPrice: data.currentPrice,
          change: data.change,
          changePercent: data.changePercent,
          history: data.history || []
        };
      }
      throw new Error(data.error || '获取失败');
    } catch (err) {
      console.error(`Sidebar trend fetch failed for ${symbol}:`, err);
      return {
        symbol,
        name: INDICES_SHORT_NAMES[symbol] || symbol,
        error: true
      };
    }
  };

  // Fetch all pinned trends concurrently
  const fetchAllTrends = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const results = await Promise.all(pinnedSymbols.map(sym => fetchTrendData(sym)));
      const dataMap = {};
      results.forEach(res => {
        dataMap[res.symbol] = res;
      });
      setTrendsData(dataMap);
    } catch (err) {
      setError('无法获取走势图');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pinnedSymbols]);

  // Handle pin changes
  useEffect(() => {
    const handlePinsChanged = (e) => {
      if (Array.isArray(e.detail)) {
        setPinnedSymbols(e.detail);
      }
    };
    window.addEventListener('sidebarPinnedSymbolsChanged', handlePinsChanged);
    return () => window.removeEventListener('sidebarPinnedSymbolsChanged', handlePinsChanged);
  }, []);

  // Fetch on pinned symbols changes
  useEffect(() => {
    fetchAllTrends();
  }, [pinnedSymbols, fetchAllTrends]);

  // Set up auto-refresh every 60 seconds
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    
    refreshTimerRef.current = setInterval(() => {
      fetchAllTrends(true);
    }, 60000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchAllTrends]);

  const handleRowClick = (symbol) => {
    localStorage.setItem('selected_market_symbol', symbol);
    window.dispatchEvent(new CustomEvent('selectedMarketSymbolChanged', { detail: symbol }));
    setActiveTab('market');
  };

  if (pinnedSymbols.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50/50 border border-slate-200/40 rounded-2xl select-none animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          实时大盘走势
        </span>
        <button
          type="button"
          onClick={() => fetchAllTrends(true)}
          disabled={loading || isRefreshing}
          className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-white border border-transparent hover:border-slate-100 cursor-pointer disabled:opacity-50"
          title="刷新走势图"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          // Shimmer loading skeletons
          [1, 2].map(i => (
            <div key={i} className="h-[88px] w-full bg-white border border-slate-100 rounded-xl p-3 flex flex-col justify-between animate-pulse">
              <div className="flex justify-between items-start w-full">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-20 bg-slate-100 rounded" />
                  <div className="h-2.5 w-12 bg-slate-100/70 rounded" />
                </div>
                <div className="space-y-1.5 flex flex-col items-end shrink-0">
                  <div className="h-3.5 w-16 bg-slate-100 rounded" />
                  <div className="h-4.5 w-12 bg-slate-100/70 rounded" />
                </div>
              </div>
              <div className="h-7 w-full bg-slate-50/70 rounded-lg mt-2 shrink-0 animate-pulse" />
            </div>
          ))
        ) : (
          pinnedSymbols.map(sym => {
            const data = trendsData[sym];
            if (!data) return null;

            if (data.error) {
              return (
                <div key={sym} className="flex items-center justify-between py-3.5 px-3 bg-white border border-slate-100 rounded-xl text-[10px] text-slate-400">
                  <span className="font-bold">{data.name}</span>
                  <span className="flex items-center gap-1 text-red-500 scale-90">
                    <AlertCircle className="w-3 h-3" /> 加载失败
                  </span>
                </div>
              );
            }

            const isPositive = data.changePercent >= 0;
            const rateColorClass = isPositive 
              ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
              : 'text-emerald-600 bg-emerald-50 border-emerald-100/60';

            return (
              <div
                key={sym}
                onClick={() => handleRowClick(sym)}
                className="flex flex-col p-3 bg-white hover:bg-blue-50/10 border border-slate-200/50 hover:border-blue-200 hover:shadow-2xs rounded-xl transition-all duration-200 cursor-pointer group active:scale-[0.98]"
              >
                {/* First Row: Name and price details */}
                <div className="flex justify-between items-start w-full">
                  {/* Index Info */}
                  <div className="flex flex-col min-w-0 select-none text-left">
                    <span className="text-[11.5px] font-black text-slate-700 leading-snug group-hover:text-blue-600 transition-colors truncate">
                      {data.name}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 font-mono leading-none mt-0.5">
                      {sym}
                    </span>
                  </div>

                  {/* Price & Change Tag */}
                  <div className="flex flex-col items-end shrink-0 select-none">
                    <span className="text-11 font-black font-mono text-slate-700 leading-none tracking-tight">
                      {data.currentPrice ? (sym === 'USDCNH=X' ? data.currentPrice.toFixed(4) : data.currentPrice.toFixed(2)) : '--'}
                    </span>
                    <span className={`inline-flex items-center justify-center font-mono font-extrabold text-[9.5px] px-1.5 py-0.5 rounded border leading-none mt-1 min-w-[52px] text-center ${rateColorClass}`}>
                      {isPositive ? '+' : ''}{data.changePercent ? data.changePercent.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                </div>

                {/* Second Row: Full width Sparkline */}
                <div className="w-full h-8 mt-2 flex items-end">
                  <SidebarSparkline data={data.history} isPositive={isPositive} symbol={sym} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
