import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { Globe, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Clock, Compass, Gauge, Flame, BookOpen, ArrowUpRight, ArrowDownRight, Info, HelpCircle } from 'lucide-react';

// Light-weight pure SVG sparkline component for grid cards
function Sparkline({ data, isPositive }) {
  if (!data || data.length === 0) return null;
  
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const width = 100;
  const height = 30;
  const padding = 1;
  
  const points = data.map((d, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((d.value - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  }).join(' ');
  
  // Rose for up, Emerald for down (Chinese standard)
  const strokeColor = isPositive ? '#f43f5e' : '#10b981';
  const fillColor = isPositive ? 'rgba(244, 63, 94, 0.04)' : 'rgba(16, 185, 129, 0.04)';
  
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  
  return (
    <svg className="w-full h-8 overflow-visible mt-2" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polygon points={fillPoints} fill={fillColor} />
      <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ECharts line renderer for detailed interactive historical chart
function DetailedChart({ option }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
      
      const handleResize = () => {
        chartInstance.current?.resize();
      };
      
      window.addEventListener('resize', handleResize);
      
      // Cleanup resize listener
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  useEffect(() => {
    if (chartInstance.current && option) {
      chartInstance.current.setOption(option, true);
    }
  }, [option]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);
  
  return <div ref={chartRef} className="w-full h-full min-h-[220px] md:min-h-[300px]" />;
}

export default function GlobalMarketPanel() {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [selectedSymbol, setSelectedSymbol] = useState('^GSPC');
  const [detailHistory, setDetailHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [period, setPeriod] = useState('1Y'); // 1M, 3M, 6M, 1Y
  const [marketTab, setMarketTab] = useState('overview'); // 'overview' | 'predictor'

  // Filter indices into main stock indices and leading wind vane indicators
  const mainIndices = useMemo(() => {
    return indices.filter(idx => !idx.symbol.includes('CN=F') && !idx.symbol.includes('NQ=F') && !idx.symbol.includes('^HXC') && !idx.symbol.includes('USDCNH=X'));
  }, [indices]);

  const leadingIndices = useMemo(() => {
    const order = ['CN=F', '^HXC', 'NQ=F', 'USDCNH=X'];
    const filtered = indices.filter(idx => idx.symbol.includes('CN=F') || idx.symbol.includes('NQ=F') || idx.symbol.includes('^HXC') || idx.symbol.includes('USDCNH=X'));
    return [...filtered].sort((a, b) => {
      const idxA = order.findIndex(sym => a.symbol.includes(sym));
      const idxB = order.findIndex(sym => b.symbol.includes(sym));
      return idxA - idxB;
    });
  }, [indices]);

  // Calculate Sentiment Score based on leading indices
  const sentimentData = useMemo(() => {
    if (leadingIndices.length === 0) return { score: 50, label: '中性', color: 'text-slate-500', bg: 'bg-slate-100', desc: '暂无数据' };

    let weightedScoreSum = 0;
    let totalWeight = 0;

    // Weights configuration
    const weights = {
      'CN=F': 0.30,      // A50期指 (A股风向标)
      '^HXC': 0.30,      // 纳指金龙 (港股/中概风向标)
      'NQ=F': 0.20,      // 纳指期货 (美股风向标)
      'USDCNH=X': 0.20   // 离岸人民币 (外资流动风向标)
    };

    leadingIndices.forEach(item => {
      const sym = item.symbol;
      const change = item.changePercent;
      let score = 50;

      if (sym.includes('USDCNH=X')) {
        // CNH Exchange rate: negative change (RMB appreciated) is positive for stock sentiment
        score = 50 - change * 50;
      } else {
        // Futures / Indices: Max change +/- 3% maps to score 0-100
        score = 50 + change * 16.6;
      }

      // Cap at 0 and 100
      score = Math.max(0, Math.min(100, score));

      const key = Object.keys(weights).find(w => sym.includes(w));
      if (key) {
        const weight = weights[key];
        weightedScoreSum += score * weight;
        totalWeight += weight;
      }
    });

    const finalScore = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 50;

    let label = '多空均衡';
    let colorClass = 'text-slate-500';
    let bgClass = 'bg-slate-50';
    let borderClass = 'border-slate-200';
    let gradientFromTo = 'from-slate-400 to-slate-600';
    let shadowColor = 'rgba(148, 163, 184, 0.2)';
    let desc = '市场处于观望状态，多空力量均衡，大盘或将横盘震荡。';

    if (finalScore >= 65) {
      label = '极度乐观';
      colorClass = 'text-rose-650';
      bgClass = 'bg-rose-50/70';
      borderClass = 'border-rose-150';
      gradientFromTo = 'from-pink-500 via-rose-500 to-rose-600';
      shadowColor = 'rgba(244, 63, 94, 0.35)';
      desc = '风向标全线飘红，主力资金强劲，翌日港A股高开高走或反弹概率极高！';
    } else if (finalScore >= 52) {
      label = '多头偏优';
      colorClass = 'text-orange-600';
      bgClass = 'bg-orange-50/70';
      borderClass = 'border-orange-150';
      gradientFromTo = 'from-amber-400 to-orange-500';
      shadowColor = 'rgba(249, 115, 22, 0.25)';
      desc = '主要风向标偏多，多头力量略占上风，翌日大盘温和看涨或平稳向好。';
    } else if (finalScore >= 48) {
      label = '多空均衡';
      colorClass = 'text-slate-600';
      bgClass = 'bg-slate-50/70';
      borderClass = 'border-slate-200';
      gradientFromTo = 'from-slate-400 to-slate-500';
      shadowColor = 'rgba(148, 163, 184, 0.15)';
      desc = '市场多空力量势均力敌，没有主导方向，翌日大盘大概率宽幅横盘整理。';
    } else if (finalScore >= 35) {
      label = '空头偏优';
      colorClass = 'text-emerald-600';
      bgClass = 'bg-emerald-50/70';
      borderClass = 'border-emerald-150';
      gradientFromTo = 'from-emerald-400 to-teal-500';
      shadowColor = 'rgba(16, 185, 129, 0.25)';
      desc = '主要风向标偏弱或汇率贬值，空头压制多头，翌日大盘低开震荡回落概率高。';
    } else {
      label = '极度恐慌';
      colorClass = 'text-emerald-750';
      bgClass = 'bg-emerald-100/70';
      borderClass = 'border-emerald-250';
      gradientFromTo = 'from-emerald-500 via-teal-600 to-green-700';
      shadowColor = 'rgba(16, 185, 129, 0.4)';
      desc = '风向标惨烈低迷，人民币出现较快贬值，空头占据绝对优势，翌日大盘或加速回调。';
    }

    return { score: finalScore, label, color: colorClass, bg: bgClass, border: borderClass, gradient: gradientFromTo, shadow: shadowColor, desc };
  }, [leadingIndices]);

  // Predict next-day trends for A-shares, HK shares, and US Tech
  const marketPredictions = useMemo(() => {
    const a50 = leadingIndices.find(idx => idx.symbol.includes('CN=F'));
    const hxc = leadingIndices.find(idx => idx.symbol.includes('^HXC'));
    const nq = leadingIndices.find(idx => idx.symbol.includes('NQ=F'));
    const cnh = leadingIndices.find(idx => idx.symbol.includes('USDCNH=X'));

    const a50Chg = a50 ? a50.changePercent : 0;
    const hxcChg = hxc ? hxc.changePercent : 0;
    const nqChg = nq ? nq.changePercent : 0;
    const cnhChg = cnh ? cnh.changePercent : 0;

    // 1. A-shares prediction
    const aShareWeight = a50Chg * 0.5 + hxcChg * 0.3 - cnhChg * 2.0;
    let aShareStatus = '平盘窄幅震荡';
    let aShareProb = '50% - 60%';
    let aShareColor = 'text-slate-600 bg-slate-50 border-slate-200';
    let aShareDot = 'bg-slate-400';
    let aShareRationales = [];

    if (aShareWeight > 0.4) {
      aShareStatus = '看涨 / 高开概率大';
      aShareProb = `${Math.min(95, Math.round(62 + aShareWeight * 12))}%`;
      aShareColor = 'text-rose-600 bg-rose-50 border-rose-100';
      aShareDot = 'bg-rose-500';
    } else if (aShareWeight < -0.4) {
      aShareStatus = '看跌 / 低开震荡概率大';
      aShareProb = `${Math.min(95, Math.round(62 - aShareWeight * 12))}%`;
      aShareColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
      aShareDot = 'bg-emerald-500';
    }

    if (a50Chg > 0.3) aShareRationales.push(`富时中国A50期指大涨 +${a50Chg.toFixed(2)}%，显著提振权重蓝筹开盘意愿。`);
    else if (a50Chg < -0.3) aShareRationales.push(`富时中国A50期指走弱 ${a50Chg.toFixed(2)}%，大盘开盘点位面临承压。`);

    if (cnhChg < -0.15) aShareRationales.push(`人民币汇率显著升值（USD/CNH跌 ${Math.abs(cnhChg).toFixed(2)}%），吸引离岸资金流入资产。`);
    else if (cnhChg > 0.15) aShareRationales.push(`离岸人民币汇率走贬（涨 +${cnhChg.toFixed(2)}%），对外资流入构成汇率承压。`);

    if (hxcChg > 0.5) aShareRationales.push(`美股中概金龙指数上涨 +${hxcChg.toFixed(2)}%，外溢A股开市情绪偏向积极。`);
    else if (hxcChg < -0.5) aShareRationales.push(`美股中概金龙走低 ${hxcChg.toFixed(2)}%，中概科技板块风险偏好转弱。`);

    if (aShareRationales.length === 0) {
      aShareRationales.push('大盘四大核心前瞻风向标方向未显，市场预期大概率延续原有通道做技术性横向整固。');
    }

    // 2. HK shares prediction
    const hkWeight = hxcChg * 0.5 + nqChg * 0.2 - cnhChg * 3.0;
    let hkStatus = '多空博弈 / 横盘震荡';
    let hkProb = '50% - 60%';
    let hkColor = 'text-slate-600 bg-slate-50 border-slate-200';
    let hkDot = 'bg-slate-400';
    let hkRationales = [];

    if (hkWeight > 0.5) {
      hkStatus = '高开 / 震荡走高概率高';
      hkProb = `${Math.min(95, Math.round(65 + hkWeight * 10))}%`;
      hkColor = 'text-rose-600 bg-rose-50 border-rose-100';
      hkDot = 'bg-rose-500';
    } else if (hkWeight < -0.5) {
      hkStatus = '低开 / 顺势探底概率高';
      hkProb = `${Math.min(95, Math.round(65 - hkWeight * 10))}%`;
      hkColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
      hkDot = 'bg-emerald-500';
    }

    if (hxcChg > 0.5) hkRationales.push(`纳斯达克中概金龙指数飙升 +${hxcChg.toFixed(2)}%，直接利好翌日恒生科技与恒生大盘竞价。`);
    else if (hxcChg < -0.5) hkRationales.push(`美股中概股重挫 ${hxcChg.toFixed(2)}%，翌日恒生科技开盘情绪承压明显。`);

    if (nqChg > 0.4) hkRationales.push(`纳斯达克100期指走高 +${nqChg.toFixed(2)}%，美股科技溢出情绪对港股核心标的形成加持。`);
    else if (nqChg < -0.4) hkRationales.push(`纳指期指走弱 ${nqChg.toFixed(2)}%，投资者情绪敏感偏谨慎。`);

    if (hkRationales.length === 0) {
      hkRationales.push('港股风向指引方向偏中性，短期大概率跟随A股以及晚间美股走势窄幅震荡。');
    }

    // 3. US Stock prediction
    const usWeight = nqChg;
    let usStatus = '维持开盘平稳震荡';
    let usProb = '50% - 60%';
    let usColor = 'text-slate-600 bg-slate-50 border-slate-200';
    let usDot = 'bg-slate-400';
    let usRationales = [];

    if (usWeight > 0.3) {
      usStatus = '红盘高开 / 多头主导概率大';
      usProb = `${Math.min(95, Math.round(60 + usWeight * 15))}%`;
      usColor = 'text-rose-600 bg-rose-50 border-rose-100';
      usDot = 'bg-rose-500';
    } else if (usWeight < -0.3) {
      usStatus = '绿盘低开 / 空头回踩概率大';
      usProb = `${Math.min(95, Math.round(60 - usWeight * 15))}%`;
      usColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
      usDot = 'bg-emerald-500';
    }

    if (nqChg > 0.2) usRationales.push(`纳斯达克100期货盘前走强 +${nqChg.toFixed(2)}%，科技巨头蓄力表现，有利于美股多头今晚发力。`);
    else if (nqChg < -0.2) usRationales.push(`纳斯达克100期货走弱 ${nqChg.toFixed(2)}%，表明美股市场开市前风险偏好有所降低。`);

    if (usRationales.length === 0) {
      usRationales.push('美指期货盘前横盘胶着，市场进入“垃圾时间”静待重要事件或宏观政策指引。');
    }

    return [
      { id: 'cn', name: '中国 A 股大盘', status: aShareStatus, prob: aShareProb, color: aShareColor, dot: aShareDot, rationales: aShareRationales },
      { id: 'hk', name: '中国港股 (恒指/恒科)', status: hkStatus, prob: hkProb, color: hkColor, dot: hkDot, rationales: hkRationales },
      { id: 'us', name: '美股科技/纳指100', status: usStatus, prob: usProb, color: usColor, dot: usDot, rationales: usRationales }
    ];
  }, [leadingIndices]);

  // Fetch all indices overview
  const fetchOverview = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const res = await fetch('/api/market');
      if (!res.ok) {
        throw new Error(`加载全局行情失败: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.indices)) {
        setIndices(data.indices);
        setLastUpdated(data.timestamp ? new Date(data.timestamp) : new Date());
        
        // Auto select first index if currently selected is not in the list
        if (!data.indices.some(idx => idx.symbol === selectedSymbol) && data.indices.length > 0) {
          setSelectedSymbol(data.indices[0].symbol);
        }
      } else {
        throw new Error(data.error || '返回的行情数据格式有误');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch detailed history for selected symbol
  const fetchDetail = async (symbol) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&range=1y`);
      if (!res.ok) {
        throw new Error(`加载详细历史行情失败: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setDetailHistory(data.history);
      } else {
        throw new Error(data.error || '返回的详细历史数据格式有误');
      }
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Load overview on mount
  useEffect(() => {
    fetchOverview();
  }, []);

  // Fetch details when selected symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      fetchDetail(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Find active index information
  const activeIndex = useMemo(() => {
    return indices.find(idx => idx.symbol === selectedSymbol) || null;
  }, [indices, selectedSymbol]);

  // Filter history based on selected period
  const filteredHistory = useMemo(() => {
    if (detailHistory.length === 0) return [];
    
    const now = new Date();
    let daysToKeep = 365;
    if (period === '1M') daysToKeep = 30;
    else if (period === '3M') daysToKeep = 90;
    else if (period === '6M') daysToKeep = 180;
    
    const targetDate = new Date(now.getTime() - daysToKeep * 24 * 60 * 60 * 1000);
    const targetKey = targetDate.toISOString().split('T')[0];
    
    return detailHistory.filter(pt => pt.date >= targetKey);
  }, [detailHistory, period]);

  // Compute detailed statistics of filtered history
  const activeStats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    
    const values = filteredHistory.map(pt => pt.value);
    const startVal = values[0];
    const endVal = values[values.length - 1];
    
    const high = Math.max(...values);
    const low = Math.min(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    const change = endVal - startVal;
    const changePercent = (change / startVal) * 100;
    
    return {
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      periodChange: Number(change.toFixed(2)),
      periodChangePercent: Number(changePercent.toFixed(2)),
      startVal: Number(startVal.toFixed(2)),
      endVal: Number(endVal.toFixed(2))
    };
  }, [filteredHistory]);

  // Create ECharts option config
  const chartOption = useMemo(() => {
    if (filteredHistory.length === 0 || !activeIndex) return null;
    
    const dates = filteredHistory.map(pt => pt.date);
    const values = filteredHistory.map(pt => pt.value);
    
    const isPositive = activeIndex.changePercent >= 0;
    const lineColor = isPositive ? '#f43f5e' : '#10b981'; // Rose for up, Emerald for down
    
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const pt = params[0];
          return `
            <div style="font-family: sans-serif; padding: 4px 8px;">
              <div style="font-size: 10px; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">${pt.name}</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ${lineColor};"></span>
                <span style="font-size: 13px; font-weight: 800; color: #334155; font-family: monospace;">${Number(pt.value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        shadowColor: 'rgba(0, 0, 0, 0.05)',
        shadowBlur: 10,
        textStyle: { color: '#334155' }
      },
      grid: {
        left: '2%',
        right: '2%',
        top: '6%',
        bottom: '4%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          fontSize: 9,
          color: '#94a3b8',
          fontFamily: 'monospace',
          maxInterval: 30
        },
        axisLine: {
          lineStyle: { color: '#f1f5f9' }
        },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          fontSize: 9,
          color: '#94a3b8',
          fontFamily: 'monospace',
          formatter: (value) => value.toLocaleString('zh-CN')
        },
        splitLine: {
          lineStyle: { type: 'dashed', color: '#f1f5f9' }
        }
      },
      series: [{
        data: values,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: lineColor,
          width: 2.2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isPositive ? 'rgba(244, 63, 94, 0.18)' : 'rgba(16, 185, 129, 0.18)' },
            { offset: 1, color: isPositive ? 'rgba(244, 63, 94, 0.005)' : 'rgba(16, 185, 129, 0.005)' }
          ])
        }
      }]
    };
  }, [filteredHistory, activeIndex]);

  // Format currency/number
  const formatIndexPrice = (val) => {
    if (!Number.isFinite(val)) return '--';
    return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">
      
      {/* Left Area: Indices Card Grid (7/12 cols on desktop) */}
      <div className="col-span-1 md:col-span-7 flex flex-col gap-4 min-h-[300px] md:h-full md:overflow-hidden">
        
        {/* Dashboard Title & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/50 shadow-xs shrink-0 gap-3 sm:gap-0 animate-in fade-in duration-200">
          
          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner w-full sm:w-auto shrink-0 select-none">
            <button
              onClick={() => setMarketTab('overview')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                marketTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/10'
                  : 'text-slate-500 hover:text-slate-805'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>全球主流大盘</span>
            </button>
            <button
              onClick={() => setMarketTab('predictor')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer relative ${
                marketTab === 'predictor'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/10'
                  : 'text-slate-500 hover:text-slate-805'
              }`}
            >
              <Compass className="w-3.5 h-3.5 animate-spin-slow" />
              <span className="relative flex items-center">
                翌日走势预测
                <span className="absolute -top-1 -right-3 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              </span>
            </button>
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-[10px] md:text-[11px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1.5 sm:py-1 rounded-full border border-slate-200/30">
                <Clock className="w-3 h-3 text-slate-400" />
                {lastUpdated.toLocaleTimeString('zh-CN')} 更新
              </span>
            )}
            <button
              onClick={() => fetchOverview(true)}
              disabled={loading || isRefreshing}
              className="flex items-center justify-center p-2 sm:p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 transition-all text-slate-500 cursor-pointer disabled:opacity-50"
              title="一键刷新行情"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Card Grid Container */}
        <div className="flex-1 md:overflow-y-auto custom-scrollbar pr-0 md:pr-1">
          {loading ? (
            /* Loading skeletons */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4.5 h-[120px] animate-pulse flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="h-4.5 w-24 bg-slate-100 rounded" />
                    <div className="h-4 w-12 bg-slate-100 rounded" />
                  </div>
                  <div className="h-6 w-32 bg-slate-100 rounded" />
                  <div className="h-6 bg-slate-100 rounded-md" />
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error display */
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200/60 rounded-3xl p-6 text-center">
              <div className="p-3 bg-red-50 text-red-500 rounded-2xl mb-3 border border-red-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm md:text-base">无法获取股市数据</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{error}</p>
              <button
                onClick={() => fetchOverview()}
                className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
              >
                重试加载
              </button>
            </div>
          ) : marketTab === 'overview' ? (
            /* ================= TAB 1: OVERVIEW CARD GRID ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
              {mainIndices.map((item) => {
                const isSelected = item.symbol === selectedSymbol;
                const isPositive = item.changePercent >= 0;
                
                const rateColorClass = isPositive 
                  ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
                  : 'text-emerald-600 bg-emerald-50 border-emerald-100/60';
                
                const regionBadges = {
                  'US': '🇺🇸 美国',
                  'CN': '🇨🇳 中国',
                  'HK': '🇭🇰 香港',
                  'JP': '🇯🇵 日本',
                  'UK': '🇬🇧 英国',
                  'DE': '🇩🇪 德国'
                };
                
                return (
                  <div
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`border rounded-2xl p-4 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50/50 hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer relative group overflow-hidden ${
                      isSelected 
                        ? 'border-blue-500 ring-3 ring-blue-500/10 bg-gradient-to-br from-white to-blue-50/20' 
                        : 'border-slate-200/60'
                    }`}
                  >
                    {/* Header info inside card */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-extrabold text-slate-400 font-mono tracking-wider">{item.symbol}</span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/30 px-2 py-0.5 rounded-full shrink-0">
                          {regionBadges[item.region] || item.regionName}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-700 text-xs leading-snug group-hover:text-blue-600 transition-colors mt-0.5" title={item.englishName}>
                        {item.name}
                      </h4>
                    </div>

                    {/* Numeric panel inside card */}
                    <div className="mt-3.5 flex justify-between items-end">
                      <div className="flex flex-col">
                        <span className="text-base font-black font-mono text-slate-700 tracking-tight">
                          {formatIndexPrice(item.currentPrice)}
                        </span>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-mono font-extrabold px-2 py-0.5 border rounded-lg shrink-0 ${rateColorClass}`}>
                        {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    {/* Pure SVG Sparkline */}
                    <div className="h-8 mt-2.5 flex items-end">
                      <Sparkline data={item.sparkline} isPositive={isPositive} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= TAB 2: PREDICTOR & WIND VANE ================= */
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              
              {/* Row 1: Sentiment Dial & Forecasts */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                
                {/* 1.1 Sentiment Meter (col-span-5) */}
                <div className="xl:col-span-5 bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col items-center justify-between shadow-2xs relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/20 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-1.5 self-start mb-2">
                    <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                    <span className="text-[11px] font-black text-slate-450 uppercase tracking-wider">多空情绪温度计</span>
                  </div>
                  
                  {/* Gauge Arc representation */}
                  <div className="relative flex items-center justify-center my-2.5">
                    {/* SVG Circle Gauge */}
                    <svg className="w-36 h-36 transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="7.5"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="url(#sentimentGaugeGradient)"
                        strokeWidth="8.5"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * sentimentData.score) / 100}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                      <defs>
                        <linearGradient id="sentimentGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={sentimentData.score >= 52 ? '#fb7185' : (sentimentData.score <= 48 ? '#34d399' : '#94a3b8')} />
                          <stop offset="100%" stopColor={sentimentData.score >= 52 ? '#f43f5e' : (sentimentData.score <= 48 ? '#059669' : '#64748b')} />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Text center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                      <span className="text-3xl font-black font-mono text-slate-850 tracking-tighter">{sentimentData.score}</span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full mt-1.5 border border-current leading-none ${sentimentData.color} ${sentimentData.bg}`}>
                        {sentimentData.label}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 font-bold leading-relaxed text-center mt-2 px-1">
                    {sentimentData.desc}
                  </p>
                </div>
                
                {/* 1.2 Trend predictions (col-span-7) */}
                <div className="xl:col-span-7 bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 shadow-2xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-black text-slate-450 uppercase tracking-wider">翌日大盘开盘前瞻预测</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-3">
                    {marketPredictions.map(pred => (
                      <div key={pred.id} className="border border-slate-100 rounded-2xl p-3 bg-gradient-to-r from-slate-50/40 to-slate-50/10 hover:shadow-2xs transition-all duration-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${pred.dot}`} />
                            <h4 className="text-xs font-black text-slate-700">{pred.name}</h4>
                          </div>
                          
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 border rounded-lg ${pred.color}`}>
                            {pred.status} ({pred.prob})
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-1 pl-3.5">
                          {pred.rationales.map((rat, i) => (
                            <p key={i} className="text-[10.5px] text-slate-450 font-semibold leading-relaxed flex items-start gap-1">
                              <span className="text-slate-350 select-none">•</span>
                              <span>{rat}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Title & Core Leading Indicators cards */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 mt-1">
                  <Compass className="w-4 h-4 text-blue-500 animate-spin-slow" />
                  <span className="text-[11px] font-black text-slate-450 uppercase tracking-wider">前瞻核心风向标核心指标</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {leadingIndices.map((item) => {
                    const isSelected = item.symbol === selectedSymbol;
                    const isPositive = item.changePercent >= 0;
                    
                    const rateColorClass = isPositive 
                      ? 'text-rose-650 bg-rose-50 border-rose-100/60' 
                      : 'text-emerald-650 bg-emerald-50 border-emerald-100/60';
                    
                    const itemMeaning = {
                      'CN=F': 'A股竞价风向标。交易极其活跃，能提早30分钟对A股竞价走势做高精准前瞻。',
                      '^HXC': '美股中概晴雨表。夜盘反映美股中概股ADR涨跌，领先决定翌日港A股开盘情绪。',
                      'NQ=F': '美股科技风向标。下午交易时段直接引导港股恒生科技指数走势及中国市场氛围。',
                      'USDCNH=X': '外资流动风向标。汇率下跌（人民币升值）则外资倾向流入，利好中国股市资产。'
                    };
                    
                    const meaningText = Object.keys(itemMeaning).find(k => item.symbol.includes(k)) 
                      ? itemMeaning[Object.keys(itemMeaning).find(k => item.symbol.includes(k))] 
                      : '核心前瞻领先指标。';
                    
                    return (
                      <div
                        key={item.symbol}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className={`border rounded-3xl p-4.5 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50/50 hover:shadow-md hover:scale-[1.005] transition-all duration-200 cursor-pointer relative group overflow-hidden ${
                          isSelected 
                            ? 'border-blue-500 ring-3 ring-blue-500/10 bg-gradient-to-br from-white to-blue-50/20' 
                            : 'border-slate-200/60'
                        }`}
                      >
                        {/* Card header */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-mono tracking-wider">{item.symbol}</span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200/30 px-2.5 py-0.5 rounded-full shrink-0">
                              {item.regionName}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-700 text-xs leading-snug group-hover:text-blue-600 transition-colors mt-0.5">
                            {item.name}
                          </h4>
                        </div>
                        
                        {/* Pricing panels */}
                        <div className="mt-3 flex justify-between items-end">
                          <div className="flex flex-col">
                            <span className="text-base font-black font-mono text-slate-755 tracking-tight">
                              {formatIndexPrice(item.currentPrice)}
                            </span>
                          </div>
                          <span className={`inline-flex items-center text-[10px] font-mono font-extrabold px-2 py-0.5 border rounded-lg shrink-0 ${rateColorClass}`}>
                            {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                          </span>
                        </div>
                        
                        {/* Sparkline & custom instruction */}
                        <div className="h-8 mt-2 flex items-end">
                          <Sparkline data={item.sparkline} isPositive={isPositive} />
                        </div>
                        
                        {/* Meaning instruction */}
                        <div className="mt-3.5 border-t border-slate-100 pt-2.5">
                          <p className="text-[10px] text-slate-450 font-semibold leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-200/20">
                            <span className="font-black text-slate-550 mr-1">🔍 前瞻指引:</span>
                            {meaningText}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Educational Insights Timeline */}
              <div className="bg-slate-50 border border-slate-200/40 rounded-3xl p-4.5">
                <div className="flex items-center gap-1.5 mb-3">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-[11px] font-black text-slate-550 uppercase tracking-wider">风向标全天监测时间轴 (Pro 技巧)</span>
                </div>
                
                <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200/30 flex flex-col gap-1 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">09:00 - 09:25</span>
                      <span className="text-[9px] font-black text-rose-500">A股盘前开盘</span>
                    </div>
                    <p className="text-[10px] text-slate-450 font-bold leading-relaxed mt-1">
                      盯紧 <span className="text-slate-650 font-black">富时A50期货</span>。这是新加坡提前开市的风向标，能高概率预测 09:25 A股大盘集合竞价的高低开方向。
                    </p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl border border-slate-200/30 flex flex-col gap-1 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">09:30 - 15:00</span>
                      <span className="text-[9px] font-black text-blue-500">盘中交易时段</span>
                    </div>
                    <p className="text-[10px] text-slate-450 font-bold leading-relaxed mt-1">
                      重点观察 <span className="text-slate-650 font-black">纳指期货 (NQ)</span> 与汇率。若纳指期指盘中拉升，通常会提振港股及A股科技龙头，催化午后拉升反弹。
                    </p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl border border-slate-200/30 flex flex-col gap-1 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">21:30 - 04:00</span>
                      <span className="text-[9px] font-black text-amber-600">美股美东时间</span>
                    </div>
                    <p className="text-[10px] text-slate-450 font-bold leading-relaxed mt-1">
                      盯死 <span className="text-slate-650 font-black">中概金龙指数 (^HXC)</span>。其在美股市场的最终收盘涨跌，直接主导第二天港股与A股开盘情绪的冰火两重天。
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Right Area: Large Interactive Detailed ECharts Panel (5/12 cols on desktop) */}
      <div className="col-span-1 md:col-span-5 flex flex-col bg-white border border-slate-200/60 rounded-3xl shadow-sm md:h-full md:overflow-hidden p-4 md:p-5 gap-4">
        
        {activeIndex ? (
          <>
            {/* Top Index title & Current level */}
            <div className="flex flex-col gap-1.5 shrink-0 border-b border-slate-100 pb-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-mono tracking-wide">
                  {activeIndex.symbol}
                </span>
                <span className="text-xs text-slate-400 font-bold">{activeIndex.regionName}</span>
              </div>
              
              <div className="flex justify-between items-end mt-1">
                <div>
                  <h3 className="font-black text-slate-800 text-base md:text-lg tracking-tight leading-none">
                    {activeIndex.name}
                  </h3>
                  <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase tracking-wider">{activeIndex.englishName}</p>
                </div>
                
                <div className="text-right">
                  <span className="text-lg md:text-xl font-extrabold font-mono text-slate-750 tracking-tight leading-none block">
                    {formatIndexPrice(activeIndex.currentPrice)}
                  </span>
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className={`text-xs font-mono font-bold leading-none ${activeIndex.change >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {activeIndex.change >= 0 ? '+' : ''}{activeIndex.change.toFixed(2)}
                    </span>
                    <span className={`inline-flex items-center text-[10px] font-mono font-black px-1.5 py-0.2 border rounded-md leading-none ${
                      activeIndex.changePercent >= 0 ? 'text-rose-600 bg-rose-50/50 border-rose-100' : 'text-emerald-600 bg-emerald-50/50 border-emerald-100'
                    }`}>
                      {activeIndex.changePercent >= 0 ? '+' : ''}{activeIndex.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Controls (Period selector) */}
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">历史趋势大图</span>
              
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 w-fit shrink-0 select-none">
                {['1M', '3M', '6M', '1Y'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                      period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {p === '1M' ? '近1月' : p === '3M' ? '近3月' : p === '6M' ? '近6月' : '近1年'}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Stats Panel */}
            {activeStats && (
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-150/50 shrink-0 font-mono select-none">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">最高价格</span>
                  <span className="text-xs font-black text-slate-700 mt-0.5">{formatIndexPrice(activeStats.high)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">最低价格</span>
                  <span className="text-xs font-black text-slate-700 mt-0.5">{formatIndexPrice(activeStats.low)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">区间涨跌</span>
                  <span className={`text-xs font-black mt-0.5 ${activeStats.periodChangePercent >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {activeStats.periodChangePercent >= 0 ? '+' : ''}{activeStats.periodChangePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* ECharts Area Chart Container */}
            <div className="flex-1 bg-white border border-slate-150/40 rounded-2xl p-2 relative overflow-hidden min-h-[220px] md:min-h-0 flex flex-col justify-center shadow-inner">
              {detailLoading ? (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-3xs flex items-center justify-center z-10 select-none">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                    <span className="text-xs font-bold text-slate-400">行情加载中...</span>
                  </div>
                </div>
              ) : null}
              
              {detailError ? (
                <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-4 text-center z-10 select-none">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <p className="text-xs text-slate-500 font-bold mt-1">{detailError}</p>
                </div>
              ) : null}

              {filteredHistory.length > 0 && chartOption ? (
                <DetailedChart option={chartOption} />
              ) : (
                <div className="text-center text-xs text-slate-400">暂无历史走势数据</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
            <Globe className="w-10 h-10 text-slate-300 animate-pulse" />
            <p className="text-xs text-slate-400 font-semibold mt-2">请在左侧选择一个股指查看历史详细走势</p>
          </div>
        )}
      </div>

    </div>
  );
}
