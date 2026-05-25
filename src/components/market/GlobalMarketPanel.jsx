import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { Globe, RefreshCw, AlertCircle, TrendingUp, TrendingDown, Clock, Compass, Gauge, Flame, BookOpen, ArrowUpRight, ArrowDownRight, Info, HelpCircle, Cpu, Sliders, Play, ShieldAlert, CheckCircle, Activity } from 'lucide-react';

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
  const [marketTab, setMarketTab] = useState('overview'); // 'overview' | 'predictor' | 'advisor'

  // Quantitative Advisor States
  const [isNoviceMode, setIsNoviceMode] = useState(true); // Default to true (jargon-free novice mode!)
  const [advisorSubTab, setAdvisorSubTab] = useState('china'); // 'china' | 'us'
  const [chinaA50Input, setChinaA50Input] = useState(0.0);
  const [chinaHxcInput, setChinaHxcInput] = useState(0.0);
  const [chinaSimMode, setChinaSimMode] = useState(false);

  const [usNasdaqInput, setUsNasdaqInput] = useState(0.0);
  const [usSp505Input, setUsSp505Input] = useState(0.0);
  const [usMacroData, setUsMacroData] = useState(false);
  const [usSimMode, setUsSimMode] = useState(false);

  // Sync real-time rates to inputs when indices load
  useEffect(() => {
    if (indices && indices.length > 0) {
      const a50Obj = indices.find(idx => idx.symbol === 'CN=F');
      const hxcObj = indices.find(idx => idx.symbol === '^HXC');
      const nqObj = indices.find(idx => idx.symbol === 'NQ=F');
      const esObj = indices.find(idx => idx.symbol === 'ES=F');

      const a50Val = a50Obj ? a50Obj.changePercent : 0.0;
      const hxcVal = hxcObj ? hxcObj.changePercent : 0.0;
      const nqVal = nqObj ? nqObj.changePercent : 0.0;
      const esVal = esObj ? esObj.changePercent : 0.0;

      if (!chinaSimMode) {
        setChinaA50Input(Number(a50Val.toFixed(2)));
        setChinaHxcInput(Number(hxcVal.toFixed(2)));
      }
      if (!usSimMode) {
        setUsNasdaqInput(Number(nqVal.toFixed(2)));
        setUsSp505Input(Number(esVal.toFixed(2)));
      }
    }
  }, [indices, chinaSimMode, usSimMode]);

  const handleResetChinaRealTime = () => {
    setChinaSimMode(false);
    if (indices && indices.length > 0) {
      const a50 = indices.find(idx => idx.symbol === 'CN=F')?.changePercent ?? 0.0;
      const hxc = indices.find(idx => idx.symbol === '^HXC')?.changePercent ?? 0.0;
      setChinaA50Input(Number(a50.toFixed(2)));
      setChinaHxcInput(Number(hxc.toFixed(2)));
    }
  };

  const handleResetUsRealTime = () => {
    setUsSimMode(false);
    if (indices && indices.length > 0) {
      const nq = indices.find(idx => idx.symbol === 'NQ=F')?.changePercent ?? 0.0;
      const es = indices.find(idx => idx.symbol === 'ES=F')?.changePercent ?? 0.0;
      setUsNasdaqInput(Number(nq.toFixed(2)));
      setUsSp505Input(Number(es.toFixed(2)));
    }
  };

  // China / A-shares advisor signal processing
  const chinaAdvisorData = useMemo(() => {
    const f_a50_morning = chinaA50Input;
    const hxc_last_night = chinaHxcInput;
    const growth_sentiment = 0.4 * f_a50_morning + 0.6 * hxc_last_night;
    
    let activeRule = -1;
    let signal = "";
    let action = "";
    let label = "";
    let color = "";
    let bg = "";
    let border = "";
    let indicator = "";
    let cardGradient = "";
    
    // 决策 1：全面共振暴跌
    if (f_a50_morning <= -0.8 && hxc_last_night <= -1.5) {
      activeRule = 1;
      signal = "🔴 [严重警报] 大A与创业板今早将大幅低开！";
      action = "今日场外基金禁止加仓。场内ETF若想减仓，静待9:45左右的反抽高点，切勿在9:30开盘第一分钟割肉。";
      label = "共振暴跌";
      color = "text-rose-600";
      bg = "bg-rose-50/90";
      border = "border-rose-250";
      indicator = "bg-rose-500 animate-pulse";
      cardGradient = "from-red-500/10 via-rose-500/5 to-transparent";
    }
    // 决策 2：全面共振大涨
    else if (f_a50_morning >= 0.8 && hxc_last_night >= 1.5) {
      activeRule = 2;
      signal = "🟢 [多头逼空] 大A与创业板今早将大幅高开！";
      action = "情绪极其亢奋。场内ETF切勿开盘无脑追高（谨防高开低走）；场外基金如需建仓，可在下午14:30观察是否抱团封死阳线再做决定。";
      label = "多头逼空";
      color = "text-emerald-600";
      bg = "bg-emerald-50/90";
      border = "border-emerald-250";
      indicator = "bg-emerald-500 animate-pulse";
      cardGradient = "from-emerald-500/10 via-teal-500/5 to-transparent";
    }
    // 决策 3：存量博弈，结构分化
    else if (f_a50_morning >= 0.5 && hxc_last_night <= -1.0) {
      activeRule = 3;
      signal = "🟡 [二八分化] 传统蓝筹护盘，创业板承压！";
      action = "今天国家队可能会拉中字头、银行（A50强），但新能源、半导体等创业板权重（受中概拖累）会走弱。个股/行业基金各走各路，不宜盲目乱动。";
      label = "二八分化";
      color = "text-amber-600";
      bg = "bg-amber-50/90";
      border = "border-amber-250";
      indicator = "bg-amber-500 animate-pulse";
      cardGradient = "from-amber-500/10 via-yellow-500/5 to-transparent";
    }
    // 默认：震荡市
    else {
      activeRule = 4;
      signal = "⚪ [震荡市] 离岸市场波动微弱";
      action = "大A今天大概率维持震荡横盘，按照既定定投计划执行即可，无超额盘中交易机会。";
      label = "震荡整理";
      color = "text-slate-650";
      bg = "bg-slate-50/90";
      border = "border-slate-250";
      indicator = "bg-slate-400";
      cardGradient = "from-slate-400/5 to-transparent";
    }
    
    return { f_a50_morning, hxc_last_night, growth_sentiment, activeRule, signal, action, label, color, bg, border, indicator, cardGradient };
  }, [chinaA50Input, chinaHxcInput]);

  // US stocks dual-threshold advisor signal processing
  const usAdvisorData = useMemo(() => {
    const f_nasdaq = usNasdaqInput;
    const f_sp500 = usSp505Input;
    const has_macro_data = usMacroData;
    const spread = Math.abs(f_nasdaq - f_sp500);
    
    let activeRule = -1;
    let signal = "";
    let action = "";
    let label = "";
    let color = "";
    let bg = "";
    let border = "";
    let indicator = "";
    let cardGradient = "";
    
    // 规则 0: 熔断机制保护
    if (f_nasdaq <= -5.0 || f_sp500 <= -5.0) {
      activeRule = 0;
      signal = "⚠️ EMERGENCY_STOP - 期货触发盘前熔断！";
      action = "🔥 今晚美股将面临灾难级暴跌。15:00前有仓位的立刻申请赎回避险，绝对禁止买入！";
      label = "极端熔断";
      color = "text-red-750";
      bg = "bg-red-100/90 animate-pulse";
      border = "border-red-400";
      indicator = "bg-red-650 animate-ping";
      cardGradient = "from-red-600/20 to-transparent";
    }
    // 规则 1: 宏观黑天鹅过滤
    else if (has_macro_data) {
      activeRule = 1;
      signal = "⏳ [数据日] 宏观数据落地，下午走势强欺骗性！";
      action = "⏳ 今晚有重大数据公布，下午期货属于强欺骗性信号。推测开盘：无法精准推测。操作：维持常规计划，不做任何临时增减仓。";
      label = "宏观过滤";
      color = "text-slate-600";
      bg = "bg-slate-50/90";
      border = "border-slate-300";
      indicator = "bg-slate-400";
      cardGradient = "from-slate-400/10 to-transparent";
    }
    // 规则 2: 空头多模共振
    else if (f_nasdaq <= -0.8 && f_sp500 <= -0.6 && spread <= 0.6) {
      activeRule = 2;
      signal = "🔴 [精准卖出 / 暂停申购] 信号触发";
      action = "🔴 推测开盘：21:30 100%低开。操作：今晚美股大概率暴跌，适合15:00前卖出止盈；若要买入则执行【暂停】，等明天以更低净值低吸。";
      label = "空头共振";
      color = "text-rose-650";
      bg = "bg-rose-50/90";
      border = "border-rose-250";
      indicator = "bg-rose-500 animate-pulse";
      cardGradient = "from-red-500/10 via-rose-500/5 to-transparent";
    }
    // 规则 3: 多头多模共振
    else if (f_nasdaq >= 0.8 && f_sp500 >= 0.5 && spread <= 0.6) {
      activeRule = 3;
      signal = "🟢 [精准买入 / 坚定加仓] 信号触发";
      action = "🟢 推测开盘：21:30 100%高开。操作：逼空行情确立，适合15:00前果断加仓买入，直接收割今晚涨幅，禁止卖出让利润奔跑。";
      label = "多头逼空";
      color = "text-emerald-650";
      bg = "bg-emerald-50/90";
      border = "border-emerald-250";
      indicator = "bg-emerald-500 animate-pulse";
      cardGradient = "from-emerald-500/10 via-teal-500/5 to-transparent";
    }
    // 规则 4: 数据撕裂或区间震荡 - 波动极小
    else if (Math.abs(f_nasdaq) < 0.5 && Math.abs(f_sp500) < 0.5) {
      activeRule = 4;
      signal = "⚪ [静默观望] 进入无方向垃圾时间";
      action = "⚪ 推测开盘：平开或温和震荡。操作：下午走势属于噪音，无胜率优势。严格禁止打破常规的调仓，维持既定定投。";
      label = "区间震荡";
      color = "text-slate-650";
      bg = "bg-slate-50/90";
      border = "border-slate-200/60";
      indicator = "bg-slate-400";
      cardGradient = "from-slate-400/5 to-transparent";
    }
    // 规则 4: 数据撕裂或区间震荡 - 背离过大
    else if (spread > 1.2) {
      activeRule = 5;
      signal = "🟡 [背离警告] 指数发生严重割裂失真";
      action = "🟡 推测开盘：指数严重撕裂分化，开盘后极易剧烈震荡洗盘。操作：信号失真，严格禁止任何调仓，以默认定投应万变。";
      label = "背离撕裂";
      color = "text-amber-650";
      bg = "bg-amber-50/90";
      border = "border-amber-250";
      indicator = "bg-amber-550";
      cardGradient = "from-amber-500/10 via-yellow-500/5 to-transparent";
    }
    else {
      activeRule = 6;
      signal = "⚪ 执行默认日常计划";
      action = "执行默认日常定投计划。盘前大盘走势未形成多空偏好，维持雷打不动的日常动作。";
      label = "震荡观望";
      color = "text-slate-500";
      bg = "bg-slate-50/90";
      border = "border-slate-200/60";
      indicator = "bg-slate-400";
      cardGradient = "from-slate-400/5 to-transparent";
    }
    
    return { f_nasdaq, f_sp500, has_macro_data, spread, activeRule, signal, action, label, color, bg, border, indicator, cardGradient };
  }, [usNasdaqInput, usSp505Input, usMacroData]);

  // Jargon-free market weather indicators for Novice Mode
  const chinaWeather = useMemo(() => {
    const f_a50 = chinaA50Input;
    const hxc = chinaHxcInput;
    
    let a50Weather = "⛅ 多云 (平稳没有大涨大跌)";
    let a50Bg = "bg-slate-50 border-slate-200/50";
    let a50Emoji = "⛅";
    let a50Color = "text-slate-600";
    
    if (f_a50 >= 0.8) {
      a50Weather = "☀️ 晴天 (大上市公司强劲拉升)";
      a50Bg = "bg-rose-50/70 border-rose-150 shadow-3xs";
      a50Emoji = "☀️";
      a50Color = "text-rose-600";
    } else if (f_a50 <= -0.8) {
      a50Weather = "🌧️ 雨天 (核心股票明显下跌)";
      a50Bg = "bg-emerald-50/70 border-emerald-150 shadow-3xs";
      a50Emoji = "🌧️";
      a50Color = "text-emerald-600";
    }
    
    let hxcWeather = "⛅ 多云 (科技股平稳整理)";
    let hxcBg = "bg-slate-50 border-slate-200/50";
    let hxcEmoji = "⛅";
    let hxcColor = "text-slate-600";
    
    if (hxc >= 1.5) {
      hxcWeather = "☀️ 晴天 (中概科技股超级大涨)";
      hxcBg = "bg-rose-50/70 border-rose-150 shadow-3xs";
      hxcEmoji = "☀️";
      hxcColor = "text-rose-600";
    } else if (hxc <= -1.5) {
      hxcWeather = "🌧️ 雨天 (中概科技股陷入大跌)";
      hxcBg = "bg-emerald-50/70 border-emerald-150 shadow-3xs";
      hxcEmoji = "🌧️";
      hxcColor = "text-emerald-600";
    }
    
    return { a50Weather, a50Bg, a50Emoji, a50Color, hxcWeather, hxcBg, hxcEmoji, hxcColor };
  }, [chinaA50Input, chinaHxcInput]);

  const usWeather = useMemo(() => {
    const nq = usNasdaqInput;
    const es = usSp505Input;
    
    let nqWeather = "⛅ 多云 (科技股走势温和)";
    let nqBg = "bg-slate-50 border-slate-200/50";
    let nqEmoji = "⛅";
    let nqColor = "text-slate-600";
    
    if (nq >= 0.8) {
      nqWeather = "☀️ 晴天 (科技股强劲大涨)";
      nqBg = "bg-rose-50/70 border-rose-150 shadow-3xs";
      nqEmoji = "☀️";
      nqColor = "text-rose-600";
    } else if (nq <= -0.8) {
      nqWeather = "🌧️ 雨天 (科技股恐慌下杀)";
      nqBg = "bg-emerald-50/70 border-emerald-150 shadow-3xs";
      nqEmoji = "🌧️";
      nqColor = "text-emerald-600";
    } else if (nq <= -5.0) {
      nqWeather = "🚨 暴风雪 (特大崩盘熔断！)";
      nqBg = "bg-red-50/70 border-red-150 shadow-3xs";
      nqEmoji = "🚨";
      nqColor = "text-red-600 animate-pulse";
    }
    
    let esWeather = "⛅ 多云 (美国大盘窄幅整理)";
    let esBg = "bg-slate-50 border-slate-200/50";
    let esEmoji = "⛅";
    let esColor = "text-slate-600";
    
    if (es >= 0.5) {
      esWeather = "☀️ 晴天 (美国整体大公司普涨)";
      esBg = "bg-rose-50/70 border-rose-150 shadow-3xs";
      esEmoji = "☀️";
      esColor = "text-rose-600";
    } else if (es <= -0.6) {
      esWeather = "🌧️ 雨天 (美国整体大公司回调)";
      esBg = "bg-emerald-50/70 border-emerald-150 shadow-3xs";
      esEmoji = "🌧️";
      esColor = "text-emerald-600";
    }
    
    return { nqWeather, nqBg, nqEmoji, nqColor, esWeather, esBg, esEmoji, esColor };
  }, [usNasdaqInput, usSp505Input]);

  // Filter indices into main stock indices and leading wind vane indicators
  const mainIndices = useMemo(() => {
    return indices.filter(idx => !idx.symbol.includes('CN=F') && !idx.symbol.includes('NQ=F') && !idx.symbol.includes('ES=F') && !idx.symbol.includes('^HXC') && !idx.symbol.includes('USDCNH=X'));
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

  const renderTopControlBar = () => {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 select-none pb-1">
        {/* Left Side: Segment controller for A-shares vs US-shares */}
        <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner flex items-center gap-1 w-full sm:w-auto">
          <button
            onClick={() => setAdvisorSubTab('china')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              advisorSubTab === 'china'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🇨🇳 A股/创业板早盘预测 (09:15前)</span>
          </button>
          <button
            onClick={() => setAdvisorSubTab('us')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              advisorSubTab === 'us'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🇺🇸 美股/海外基金决策 (15:00前)</span>
          </button>
        </div>

        {/* Right Side: Jargon-free Novice Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner self-end sm:self-auto select-none">
          <button
            onClick={() => setIsNoviceMode(true)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              isNoviceMode
                ? 'bg-blue-600 text-white shadow-xs border border-blue-500/20 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>极简小白模式 🐣</span>
          </button>
          <button
            onClick={() => setIsNoviceMode(false)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              !isNoviceMode
                ? 'bg-blue-600 text-white shadow-xs border border-blue-500/20 font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>专业量化模式 ⚙️</span>
          </button>
        </div>
      </div>
    );
  };

  const renderNoviceView = () => {
    // Dynamic mapping of technical signal labels into jargon-free weather conditions for Novice Mode
    const chinaStatusLabel = {
      '共振暴跌': '🌧️ 全线大跌 (雷雨天气)',
      '多头逼空': '☀️ 全线大涨 (晴空万里)',
      '二八分化': '⛅ 蓝筹涨、科技跌 (冷热不均)',
      '震荡整理': '☁️ 窄幅震荡 (微风轻拂)'
    }[chinaAdvisorData.label] || chinaAdvisorData.label;

    const usStatusLabel = {
      '极端熔断': '🚨 极端崩盘 (台风红色预警)',
      '宏观过滤': '⏳ 重磅数据日 (方向多变静观)',
      '空头共振': '🌧️ 全线普跌 (阴雨绵绵)',
      '多头逼空': '☀️ 全线大涨 (阳光普照)',
      '区间震荡': '☁️ 温和震荡 (多云微风)',
      '背离撕裂': '⚠️ 科技与大盘分裂 (冷热不均)',
      '震荡观望': '☁️ 窄幅波动 (无风微波)'
    }[usAdvisorData.label] || usAdvisorData.label;

    return (
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">
        
        {/* Left Area: Market Weather Station (5/12 cols) */}
        <div className="col-span-1 md:col-span-5 flex flex-col gap-4 select-none">
          
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-2xs flex flex-col gap-4 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/20 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📡</span>
                <span className="text-xs font-black text-slate-700 tracking-wider">海外市场实时气象站</span>
              </div>
              <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-250 animate-pulse flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                卫星实时同步中
              </span>
            </div>

            {advisorSubTab === 'china' ? (
              // China Weather Station
              <div className="flex flex-col gap-4">
                {/* A50 Weather Card */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${chinaWeather.a50Bg}`}>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-black text-slate-600">A股核心大公司前瞻 (如茅台、银行等)</span>
                    <span className="text-[10px] text-slate-400 font-bold">(富时中国 A50 指数)</span>
                    <span className={`text-[13px] font-black mt-1.5 ${chinaWeather.a50Color}`}>{chinaWeather.a50Weather}</span>
                  </div>
                  <span className="text-4xl select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]">{chinaWeather.a50Emoji}</span>
                </div>

                {/* HXC Weather Card */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${chinaWeather.hxcBg}`}>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-black text-slate-600">中国科技股前瞻 (如阿里、拼多多等)</span>
                    <span className="text-[10px] text-slate-400 font-bold">(中概金龙指数 HXC)</span>
                    <span className={`text-[13px] font-black mt-1.5 ${chinaWeather.hxcColor}`}>{chinaWeather.hxcWeather}</span>
                  </div>
                  <span className="text-4xl select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]">{chinaWeather.hxcEmoji}</span>
                </div>
              </div>
            ) : (
              // US Weather Station
              <div className="flex flex-col gap-4">
                {/* Nasdaq Futures Card */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${usWeather.nqBg}`}>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-black text-slate-600">美国高科技巨头气温 (如苹果、英伟达等)</span>
                    <span className="text-[10px] text-slate-400 font-bold">(纳斯达克 100 期货)</span>
                    <span className={`text-[13px] font-black mt-1.5 ${usWeather.nqColor}`}>{usWeather.nqWeather}</span>
                  </div>
                  <span className="text-4xl select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]">{usWeather.nqEmoji}</span>
                </div>

                {/* S&P 500 Futures Card */}
                <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${usWeather.esBg}`}>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-black text-slate-600">美国整体大盘气温 (跟踪500家美国大企业)</span>
                    <span className="text-[10px] text-slate-400 font-bold">(标谱 500 期货)</span>
                    <span className={`text-[13px] font-black mt-1.5 ${usWeather.esColor}`}>{usWeather.esWeather}</span>
                  </div>
                  <span className="text-4xl select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)]">{usWeather.esEmoji}</span>
                </div>
              </div>
            )}
          </div>

          {/* Novice Help Card */}
          <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-4.5 text-left flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
              <span>💡</span>
              <span>小白快速避坑指南</span>
            </div>
            <div className="flex flex-col gap-2 text-[10.5px] leading-relaxed font-bold text-slate-500 font-sans">
              <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-3xs">
                <span className="text-slate-700 font-extrabold block">📌 问：我持有的哪些基金能用到这个提示？</span>
                <span className="text-slate-450 block mt-1 font-semibold leading-normal">
                  答：凡是跟踪国内大A股的【沪深300】、【创业板】或者海外美股的【纳斯达克100】、【标普500】走的基金都适用。包括您持仓里的大A基金和美股海外基金。
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-3xs">
                <span className="text-slate-700 font-extrabold block">📌 问：为什么下午3点前暂停扣款能省钱？</span>
                <span className="text-slate-450 block mt-1 font-semibold leading-normal">
                  答：因为美股跳空大跌会导致明天补跌。今天下午 3:00 前去您的基金账户里【暂停定投】，明天下午就能用便宜 1% 到 2% 的更低净值买入相同的份额，白白省下买入成本！
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-3xs">
                <span className="text-slate-700 font-extrabold block">📌 问：这个投资助手是全自动的吗？为什么有手动调节的？</span>
                <span className="text-slate-450 block mt-1 font-semibold leading-normal">
                  答：本助手<span className="font-black text-rose-500">100%全自动运行，已自动接入全球实时行情</span>！页面显示的今日走势和操作意见都是系统自动算好的，您不需要手动调任何东西。手动的滑动条和输入框是“专业量化模式”下供高阶玩家模拟测试用的，小白可以直接忽略它，直接看本页的红绿字建议操作即可，超级简单！
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Area: Extremely simple large action cards (7/12 cols) */}
        <div className="col-span-1 md:col-span-7 flex flex-col md:h-full md:overflow-y-auto pr-0 md:pr-1 custom-scrollbar shrink-0">
          
          {advisorSubTab === 'china' ? (
            // China Novice Output
            <div className={`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 ${chinaAdvisorData.border} bg-gradient-to-br ${chinaAdvisorData.cardGradient}`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-xs font-black text-slate-750 tracking-wider">智能理财管家早盘建议</span>
                </div>
                <span className={`text-[10px] font-black px-3.5 py-1 rounded-full border ${chinaAdvisorData.bg} ${chinaAdvisorData.color}`}>
                  今日走势: {chinaStatusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">
                  {chinaAdvisorData.activeRule === 1 ? '🔴 今天建议暂停定投！去暂停今天扣款，明天能用更便宜的价格买入！' : 
                   chinaAdvisorData.activeRule === 2 ? '🟢 今天非常适合买入！大资金正在疯狂抢购，大涨在招手！' : 
                   chinaAdvisorData.activeRule === 3 ? '🟡 核心大公司护盘但科技股暴跌，市场冷热不均，建议不要盲目买卖！' :
                   '☁️ 今天行情很平稳。不要乱折腾，继续保持平时原有的常规扣款即可！'}
                </h2>
                
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>
                    <div className="flex flex-col gap-1 text-[12.5px] font-extrabold text-slate-650 leading-relaxed font-sans">
                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">操作指导意见</h4>
                      {chinaAdvisorData.activeRule === 1 && (
                        <p>
                          今天市场下跌意愿强劲，大盘开盘必然暴跌。<span className="text-rose-500 font-black">请立刻去理财APP或天天基金暂停您今天的扣款申购</span>。今天把定投省下来，明天下午您就能用更低的价格申购，凭空多得 1%~2% 的基金份额！
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 2 && (
                        <p>
                          大资金多头共振超级爆发，主力拉高确立！今天市场大涨概率极高，光头大阳线在招手。<span className="text-emerald-500 font-black">如果您打算做多或加仓建仓，下午 14:30 左右可以果断加仓买入</span>，直接坐享红利！手里持有的千万别卖，让利润跑起来！
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 3 && (
                        <p>
                          二八分化严重。国家队拉大蓝筹、银行板块护盘，但科技创业板权重受美股拖累走弱，板块走势南辕北辙。<span className="text-amber-500 font-black">乱折腾买卖极易吃耳光，最佳操作是持股不动，避免盲目调仓！</span>
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 4 && (
                        <p>
                          今天离岸风向标波动非常微弱，大盘将大概率横向震荡拉锯。<span className="text-blue-500 font-black">不要做任何打破常规的调仓！继续严格遵循您原有的周定投/月定投日常扣款即可</span>，多动多错，不折腾就是变相赚钱。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            // US Novice Output
            <div className={`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 ${usAdvisorData.border} bg-gradient-to-br ${usAdvisorData.cardGradient}`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-xs font-black text-slate-755 tracking-wider">智能理财管家午后建议</span>
                </div>
                <span className={`text-[10px] font-black px-3.5 py-1 rounded-full border ${usAdvisorData.bg} ${usAdvisorData.color}`}>
                  今日走势: {usStatusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">
                  {usAdvisorData.activeRule === 0 ? '⚠️ 紧急紧急！美股面临灾难级暴跌，赶快赎回跑路！' :
                   usAdvisorData.activeRule === 1 ? '⏳ 重大事件日！下午行情多噪音，按常规计划不调仓！' :
                   usAdvisorData.activeRule === 2 ? '🔴 今天建议暂停定投！去暂停今日扣款，明天能省下买入成本！' : 
                   usAdvisorData.activeRule === 3 ? '🟢 今天非常适合加仓！今晚美股极大概率大涨，下午3点前直接上车！' : 
                   usAdvisorData.activeRule === 4 ? '☁️ 市场平稳没有大方向，继续执行您的常规日常定投即可！' :
                   usAdvisorData.activeRule === 5 ? '🟡 科技股与核心大企业分裂分化，剧烈震荡洗盘中，先别买卖！' :
                   '☁️ 窄幅波动，老老实实执行常规定投，不动如山。'}
                </h2>
                
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>
                    <div className="flex flex-col gap-1 text-[12.5px] font-extrabold text-slate-650 leading-relaxed font-sans">
                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">操作指导意见</h4>
                      {usAdvisorData.activeRule === 0 && (
                        <p>
                          美股盘前触发了特大事故大熔断！开盘将面临惨烈下杀。<span className="text-red-500 font-black">请赶在下午 15:00 结束交易前申请卖出赎回避险，绝对绝对不能买入！</span>
                        </p>
                      )}
                      {usAdvisorData.activeRule === 1 && (
                        <p>
                          美国今晚有特大重磅宏观数据公布，下午的行情全是假动作烟雾弹，毫无胜率优势。<span className="text-slate-650 font-black">不要进行任何临时加仓或卖出，老老实实维持原有仓位以静制动！</span>
                        </p>
                      )}
                      {usAdvisorData.activeRule === 2 && (
                        <p>
                          欧美资金正在崩盘式出逃，今晚大跌已成定局！<span className="text-rose-500 font-black">请在下午 15:00 前去您的基金理财APP中把今天的定投扣款临时【暂停】</span>。明天下午您将以便宜 1% 到 2% 的超低成本价格买到同样的份额！如果有赎回止盈计划的，赶紧在 15:00 前卖出锁定收益！
                        </p>
                      )}
                      {usAdvisorData.activeRule === 3 && (
                        <p>
                          主力大资金多头疯抢，空头被打爆的单边大逼空行情确立！今晚美股100%跳空大涨。<span className="text-emerald-500 font-black">如果您原本就有做多计划，在下午 15:00 前赶紧砸钱加仓买入</span>，直接坐享昨晚的高额跳空红利！手里持有的筹码绝对别动！
                        </p>
                      )}
                      {usAdvisorData.activeRule === 4 && (
                        <p>
                          市场毫无方向，盘整垃圾时间。<span className="text-blue-500 font-black">严格禁止打破常规的调仓动作！继续保持日常周/月定投日常扣款即可</span>，多动多错，省下交易手续费。
                        </p>
                      )}
                      {usAdvisorData.activeRule === 5 && (
                        <p>
                          科技股被大盘撕裂割裂分化，震荡极强，洗盘行情明显。<span className="text-amber-500 font-black">信号失真，不买不卖以静制动，严格遵守日常纪律即可！</span>
                        </p>
                      )}
                      {usAdvisorData.activeRule === 6 && (
                        <p>
                          指数在窄幅区间波动，没有强单边多空信号。<span className="text-slate-600 font-black">老老实实执行您原有的定投计划，大仓位按兵不动，不用做任何额外动作。</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    );
  };

  const renderQuantAdvisorView = () => {
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0 animate-in fade-in duration-300">
        
        {/* Top Control Bar */}
        {renderTopControlBar()}

        {/* Dynamic content depending on isNoviceMode */}
        {isNoviceMode ? renderNoviceView() : renderProView()}

      </div>
    );
  };

  const renderProView = () => {
    return (
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0 animate-in duration-300">
        
        {/* Left Column: Sandbox, sliders, 4D Matrix (5 cols on desktop) */}
        <div className="col-span-1 md:col-span-5 flex flex-col gap-4 md:h-full md:overflow-y-auto pr-0 md:pr-1 custom-scrollbar shrink-0 select-none">
          
          {/* Section 1: Mode segment controller */}
          <div className="bg-slate-100 p-1 rounded-2xl border border-slate-250/60 shadow-inner flex items-center gap-1">
            <button
              onClick={() => setAdvisorSubTab('china')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                advisorSubTab === 'china'
                  ? 'bg-white text-blue-650 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="text-sm">🇨🇳</span>
              <span>A股/创业板早盘预测 (09:15前)</span>
            </button>
            <button
              onClick={() => setAdvisorSubTab('us')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                advisorSubTab === 'us'
                  ? 'bg-white text-blue-650 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="text-sm">🇺🇸</span>
              <span>美股/QDII双阈过滤 (15:00前)</span>
            </button>
          </div>

          {/* Section 2: Simulator Panel */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-2xs relative overflow-hidden flex flex-col gap-4 shrink-0">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black text-slate-700 tracking-wider">量化决策沙盒模拟器</span>
              </div>
              
              {advisorSubTab === 'china' ? (
                chinaSimMode ? (
                  <button
                    onClick={handleResetChinaRealTime}
                    className="flex items-center gap-1 text-[10px] font-black text-rose-500 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 cursor-pointer transition-all active:scale-95"
                  >
                    <Activity className="w-3 h-3 text-rose-450" />
                    <span>恢复实时数据</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-250">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>实时数据链接中</span>
                  </span>
                )
              ) : (
                usSimMode ? (
                  <button
                    onClick={handleResetUsRealTime}
                    className="flex items-center gap-1 text-[10px] font-black text-rose-500 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 cursor-pointer transition-all active:scale-95"
                  >
                    <Activity className="w-3 h-3 text-rose-455" />
                    <span>恢复实时数据</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-250">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>实时数据链接中</span>
                  </span>
                )
              )}
            </div>

            {advisorSubTab === 'china' ? (
              // China Controls
              <div className="flex flex-col gap-4">
                
                {/* A50 Futures Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500">富时中国 A50 期指日内涨跌幅 (A50期指)</span>
                    <span className={`font-mono font-extrabold ${chinaA50Input >= 0 ? 'text-rose-550' : 'text-emerald-550'}`}>
                      {chinaA50Input >= 0 ? '+' : ''}{chinaA50Input.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-4.00"
                      max="4.00"
                      step="0.05"
                      value={chinaA50Input}
                      onChange={(e) => {
                        setChinaSimMode(true);
                        setChinaA50Input(parseFloat(e.target.value));
                      }}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={chinaA50Input}
                      onChange={(e) => {
                        setChinaSimMode(true);
                        setChinaA50Input(parseFloat(e.target.value) || 0.0);
                      }}
                      className="w-16 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-700 outline-none"
                    />
                  </div>
                </div>

                {/* HXC Index Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500">昨晚美股中概金龙指数收盘涨跌幅 (中概金龙)</span>
                    <span className={`font-mono font-extrabold ${chinaHxcInput >= 0 ? 'text-rose-550' : 'text-emerald-550'}`}>
                      {chinaHxcInput >= 0 ? '+' : ''}{chinaHxcInput.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-6.00"
                      max="6.00"
                      step="0.05"
                      value={chinaHxcInput}
                      onChange={(e) => {
                        setChinaSimMode(true);
                        setChinaHxcInput(parseFloat(e.target.value));
                      }}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={chinaHxcInput}
                      onChange={(e) => {
                        setChinaSimMode(true);
                        setChinaHxcInput(parseFloat(e.target.value) || 0.0);
                      }}
                      className="w-16 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-700 outline-none"
                    />
                  </div>
                </div>

                {/* Calculated Sentiment Score Indicator */}
                <div className="border-t border-slate-100 pt-3 flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/30">
                  <div className="flex justify-between items-center text-xs font-black text-slate-700">
                    <span>创业板/科创板高敏感度因子</span>
                    <span className={`font-mono font-extrabold px-2 py-0.5 rounded-lg border text-[11px] font-black ${
                      chinaAdvisorData.growth_sentiment >= 0.5 
                        ? 'text-rose-650 bg-rose-50/70 border-rose-200' 
                        : (chinaAdvisorData.growth_sentiment <= -0.5 ? 'text-emerald-650 bg-emerald-50/70 border-emerald-200' : 'text-slate-500 bg-slate-100 border-slate-200')
                    }`}>
                      {chinaAdvisorData.growth_sentiment >= 0 ? '+' : ''}{chinaAdvisorData.growth_sentiment.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        chinaAdvisorData.growth_sentiment >= 0.5 ? 'bg-rose-500' : (chinaAdvisorData.growth_sentiment <= -0.5 ? 'bg-emerald-500' : 'bg-slate-400')
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, (chinaAdvisorData.growth_sentiment + 5) * 10))}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-bold">
                    * 该因子由 0.4 × A50期指涨跌幅 + 0.6 × 中概金龙涨跌幅加权计算，对以新能源、半导体、医药为主的科技成长标的集合竞价具有强前瞻指引作用。
                  </p>
                </div>

              </div>
            ) : (
              // US Controls
              <div className="flex flex-col gap-4">
                
                {/* Nasdaq Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500">微纳指期货日内涨跌幅 (纳指期货)</span>
                    <span className={`font-mono font-extrabold ${usNasdaqInput >= 0 ? 'text-rose-550' : 'text-emerald-555'}`}>
                      {usNasdaqInput >= 0 ? '+' : ''}{usNasdaqInput.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-6.00"
                      max="6.00"
                      step="0.05"
                      value={usNasdaqInput}
                      onChange={(e) => {
                        setUsSimMode(true);
                        setUsNasdaqInput(parseFloat(e.target.value));
                      }}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={usNasdaqInput}
                      onChange={(e) => {
                        setUsSimMode(true);
                        setUsNasdaqInput(parseFloat(e.target.value) || 0.0);
                      }}
                      className="w-16 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-700 outline-none"
                    />
                  </div>
                </div>

                {/* S&P 500 Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500">微标普期货日内涨跌幅 (标普期货)</span>
                    <span className={`font-mono font-extrabold ${usSp505Input >= 0 ? 'text-rose-550' : 'text-emerald-555'}`}>
                      {usSp505Input >= 0 ? '+' : ''}{usSp505Input.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-6.00"
                      max="6.00"
                      step="0.05"
                      value={usSp505Input}
                      onChange={(e) => {
                        setUsSimMode(true);
                        setUsSp505Input(parseFloat(e.target.value));
                      }}
                      className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={usSp505Input}
                      onChange={(e) => {
                        setUsSimMode(true);
                        setUsSp505Input(parseFloat(e.target.value) || 0.0);
                      }}
                      className="w-16 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-700 outline-none"
                    />
                  </div>
                </div>

                {/* Macro Data Toggle */}
                <label className="flex items-center justify-between rounded-2xl border border-slate-150 bg-slate-50 px-4 py-3 text-xs font-black text-slate-700 gap-2 cursor-pointer hover:bg-slate-100/50 transition-all select-none">
                  <div className="flex flex-col text-left">
                    <span>当晚 20:30 有重磅宏观数据公布</span>
                    <span className="text-[10px] text-slate-400 font-bold mt-0.5">CPI/非农就业/美联储议息决议等</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={usMacroData}
                    onChange={(e) => setUsMacroData(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                {/* Spread (Divergence) indicators */}
                <div className="border-t border-slate-100 pt-3 flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/30">
                  <div className="flex justify-between items-center text-xs font-black text-slate-700">
                    <span>两指偏离度 (偏离度 Spread)</span>
                    <span className={`font-mono font-extrabold px-2 py-0.5 rounded-lg border text-[11px] font-black ${
                      usAdvisorData.spread > 1.2 
                        ? 'text-amber-655 bg-amber-50/70 border-amber-200 animate-pulse' 
                        : (usAdvisorData.spread < 0.5 ? 'text-emerald-655 bg-emerald-50/70 border-emerald-200' : 'text-slate-500 bg-slate-100 border-slate-200')
                    }`}>
                      {usAdvisorData.spread.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        usAdvisorData.spread > 1.2 ? 'bg-amber-500' : (usAdvisorData.spread < 0.5 ? 'bg-emerald-500' : 'bg-slate-400')
                      }`}
                      style={{
                        width: `${Math.min(100, (usAdvisorData.spread / 2.0) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-bold">
                    {usAdvisorData.spread > 1.2 
                      ? '⚠️ 两指分歧度过高！科技股与价值大盘出现严重撕裂背离，信号失真，属于无效垃圾时间。' 
                      : (usAdvisorData.spread <= 0.5 ? '✅ 两指同向共振，属于极高确定性的普涨/普跌单边行情。' : 'ℹ️ 两指在日常常规震荡范围内。')}
                  </p>
                </div>

              </div>
            )}
          </div>

          {/* Section 3: 4D Matrix Grid */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-2xs relative overflow-hidden flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5 self-start">
              <Cpu className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-xs font-black text-slate-700 tracking-wider">四维量化信号矩阵映射</span>
            </div>
            
            {advisorSubTab === 'china' ? (
              // China 4D Matrix
              <div className="grid grid-cols-2 gap-3 text-center text-[11px] font-bold select-none">
                <div className={`p-3 rounded-2xl border transition-all duration-300 ${
                  chinaAdvisorData.activeRule === 2 
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-xs">🟢 全面共振大涨</div>
                  <p className="text-[9.5px] mt-1 opacity-70 leading-relaxed font-semibold">{"A50期指 >= +0.8% 且 中概金龙 >= +1.5%"}</p>
                </div>

                <div className={`p-3 rounded-2xl border transition-all duration-300 ${
                  chinaAdvisorData.activeRule === 1 
                    ? 'border-rose-500 bg-rose-50/70 text-rose-800 ring-2 ring-rose-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-xs">🔴 全面共振暴跌</div>
                  <p className="text-[9.5px] mt-1 opacity-70 leading-relaxed font-semibold">{"A50期指 <= -0.8% 且 中概金龙 <= -1.5%"}</p>
                </div>

                <div className={`p-3 rounded-2xl border transition-all duration-300 ${
                  chinaAdvisorData.activeRule === 3 
                    ? 'border-amber-500 bg-amber-50/70 text-amber-800 ring-2 ring-amber-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-xs">🟡 二八结构分化</div>
                  <p className="text-[9.5px] mt-1 opacity-70 leading-relaxed font-semibold">{"A50期指 >= +0.5% 且 中概金龙 <= -1.0%"}</p>
                </div>

                <div className={`p-3 rounded-2xl border transition-all duration-300 ${
                  chinaAdvisorData.activeRule === 4 
                    ? 'border-blue-500 bg-blue-50/70 text-blue-800 ring-2 ring-blue-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-xs">⚪ 震荡横盘市</div>
                  <p className="text-[9.5px] mt-1 opacity-70 leading-relaxed font-semibold">离岸前瞻指标微弱 呈现方向不明宽幅震荡</p>
                </div>
              </div>
            ) : (
              // US 4D Matrix
              <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] font-bold select-none">
                <div className={`p-2.5 rounded-2xl border transition-all duration-300 ${
                  usAdvisorData.activeRule === 3 
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-[11px]">🟢 强趋势多头</div>
                  <p className="text-[9px] mt-1 opacity-70 leading-normal font-semibold">{"多头共振 且 偏离度 <= 0.6%"}</p>
                </div>

                <div className={`p-2.5 rounded-2xl border transition-all duration-300 ${
                  usAdvisorData.activeRule === 2 
                    ? 'border-rose-500 bg-rose-50/70 text-rose-800 ring-2 ring-rose-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-[11px]">🔴 强趋势空头</div>
                  <p className="text-[9px] mt-1 opacity-70 leading-normal font-semibold">{"空头共振 且 偏离度 <= 0.6%"}</p>
                </div>

                <div className={`p-2.5 rounded-2xl border transition-all duration-300 ${
                  usAdvisorData.activeRule === 5 
                    ? 'border-amber-500 bg-amber-50/70 text-amber-800 ring-2 ring-amber-500/20 scale-[1.02]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-[11px]">🟡 指数背离阱</div>
                  <p className="text-[9px] mt-1 opacity-70 leading-normal font-semibold">{"同向背离较大 或 偏离度 >= 1.2%"}</p>
                </div>

                <div className={`col-span-3 p-2.5 rounded-2xl border transition-all duration-300 ${
                  (usAdvisorData.activeRule === 4 || usAdvisorData.activeRule === 1 || usAdvisorData.activeRule === 6 || usAdvisorData.activeRule === 0) 
                    ? 'border-blue-500 bg-blue-50/70 text-blue-800 ring-2 ring-blue-500/20 scale-[1.01]' 
                    : 'border-slate-150 bg-slate-50/40 text-slate-455'
                }`}>
                  <div className="font-black text-[11px]">⚪ 区间震荡 / 宏观黑天鹅过滤 / 熔断保护</div>
                  <p className="text-[9px] mt-1 opacity-70 leading-normal font-semibold">波动在 $\pm$0.6% 内，或宏观数据发布，或触发 $-5\%$ 大熔断</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Execution Output, Dynamic Highlighted Code Debugger (7 cols on desktop) */}
        <div className="col-span-1 md:col-span-7 flex flex-col gap-4 md:h-full md:overflow-y-auto pr-0 md:pr-1 custom-scrollbar shrink-0">
          
          {/* Section 4: Quantitative Action Signal Block */}
          {advisorSubTab === 'china' ? (
            // China Output Block
            <div className={`border rounded-3xl p-6 flex flex-col gap-4 shadow-xs bg-gradient-to-br ${chinaAdvisorData.cardGradient} transition-all duration-500 ${chinaAdvisorData.border}`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-black text-slate-700 tracking-wider">北京时间 09:15 前置早盘决策指令</span>
                </div>
                
                <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1 rounded-full border ${chinaAdvisorData.bg} ${chinaAdvisorData.color}`}>
                  <span className={`w-2 h-2 rounded-full ${chinaAdvisorData.indicator}`} />
                  {chinaAdvisorData.label}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-800 leading-snug">
                  {chinaAdvisorData.signal}
                </h3>
                
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base select-none shrink-0 font-black">📊</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 leading-none">前瞻预测与开盘逻辑</h4>
                      <p className="text-[11.5px] text-slate-500 leading-relaxed font-bold mt-1.5">
                        新加坡富时中国 A50 指数是外资主力博弈中国资产唯一的夜盘及盘前枢纽。早上 9:00 - 9:15 的 15 分钟走势完成了对“昨晚美股表现 + 昨晚国内重磅政策 + 早上消息面”的终极统一定价。当前 A50 盘前涨跌幅为 <span className="font-extrabold font-mono text-slate-700">{chinaA50Input >= 0 ? '+' : ''}{chinaA50Input.toFixed(2)}%</span>，中概金龙指数收盘涨跌幅为 <span className="font-extrabold font-mono text-slate-700">{chinaHxcInput >= 0 ? '+' : ''}{chinaHxcInput.toFixed(2)}%</span>。
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 my-1"></div>

                  <div className="flex items-start gap-2">
                    <span className="text-base select-none shrink-0 font-black">⚡</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 leading-none">量化操作指导建议</h4>
                      <p className="text-[11.5px] text-slate-650 leading-relaxed font-extrabold mt-1.5">
                        {chinaAdvisorData.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Educational info box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-200/20 text-[10px] text-slate-450 leading-relaxed font-bold">
                <p>
                  💡 <span className="text-slate-650 font-extrabold">场内 ETF 操作:</span> 牛市高开情绪极其亢奋，开盘无脑追高往往会吃“高开低走”的闷棍。建议耐心等待 10:00 获利盘砸出的日内低吸黄金点。
                </p>
                <p>
                  💡 <span className="text-slate-650 font-extrabold">场外 15:00 决策:</span> 场外基金以当天15:00收盘净值成交。早盘强单边共振往往决定了全天“光头大阳”或“大阴线”的走向，能够帮助我们提前锁定低吸或成功规避连续阴跌。
                </p>
              </div>

            </div>
          ) : (
            // US Output Block
            <div className={`border rounded-3xl p-6 flex flex-col gap-4 shadow-xs bg-gradient-to-br ${usAdvisorData.cardGradient} transition-all duration-500 ${usAdvisorData.border}`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-black text-slate-700 tracking-wider">北京时间 15:00 午后交易决策指令</span>
                </div>
                
                <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1 rounded-full border ${usAdvisorData.bg} ${usAdvisorData.color}`}>
                  <span className={`w-2 h-2 rounded-full ${usAdvisorData.indicator}`} />
                  {usAdvisorData.label}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg md:text-xl font-extrabold text-slate-800 leading-snug">
                  {usAdvisorData.signal}
                </h3>
                
                <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base select-none shrink-0 font-black">📊</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 leading-none">美股盘前趋势推测</h4>
                      <p className="text-[11.5px] text-slate-500 leading-relaxed font-bold mt-1.5">
                        在 14:50 核心节点，美股主力机构尚未进场，期货价格反映了全球盘前多空情绪共振。当前微纳指期货涨跌幅为 <span className="font-extrabold font-mono text-slate-700">{usNasdaqInput >= 0 ? '+' : ''}{usNasdaqInput.toFixed(2)}%</span>，微标普期货涨跌幅为 <span className="font-extrabold font-mono text-slate-700">{usSp505Input >= 0 ? '+' : ''}{usSp505Input.toFixed(2)}%</span>，两指偏离度为 <span className="font-extrabold font-mono text-slate-700">{usAdvisorData.spread.toFixed(2)}%</span>。
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 my-1"></div>

                  <div className="flex items-start gap-2">
                    <span className="text-base select-none shrink-0 font-black">⚡</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 leading-none">精准买卖操作决策</h4>
                      <p className="text-[11.5px] text-slate-650 leading-relaxed font-extrabold mt-1.5">
                        {usAdvisorData.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Educational info box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-200/20 text-[10px] text-slate-450 leading-relaxed font-bold font-sans">
                <p>
                  💡 <span className="text-slate-650 font-extrabold">QDII 赎回与暂停逻辑:</span> QDII 赎回按照当天（T日）收盘净值确认。由于盘前期货大跌预示今晚 21:30 跳空低开，15:00 前立刻申请卖出或暂停买入，可变相白赚 1%-2% 的份额资产。
                </p>
                <p>
                  💡 <span className="text-slate-650 font-extrabold">逼空坚定加仓逻辑:</span> 很多人涨了不敢追，但在量化多模共振暴涨里，这预示着欧美资金大举扫货逼空。在 A 股 15:00 结束交易前果断买入加仓直接“坐轿子”，明天净值将直接大吃一笔昨晚的高开涨幅。
                </p>
              </div>

            </div>
          )}

          {/* Section 5: Dynamic Highlighting Code Debugger Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col gap-3 font-mono text-left select-text">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-1">Quant Python Debugger Terminal</span>
              </div>
              <span className="text-[9px] font-bold text-slate-600 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md leading-none">Python v3.11</span>
            </div>

            {/* Python code output with dynamic line-by-line highlighting */}
            <div className="text-[11.5px] font-semibold leading-relaxed overflow-x-auto custom-scrollbar whitespace-nowrap text-slate-400 py-1 font-mono">
              {advisorSubTab === 'china' ? (
                // China Python Code
                <div className="flex flex-col gap-0.5 select-text font-mono">
                  <div className="text-slate-500">1: <span className="text-blue-450 font-bold">def</span> <span className="text-emerald-400 font-bold">generate_china_market_signal</span>(f_a50_morning, hxc_last_night):</div>
                  <div className="text-slate-500">2:     <span className="text-slate-550 italic"># 创业板高敏感度因子 = 40% A50期指 + 60% 中概金龙指数</span></div>
                  <div className="text-slate-500">3:     growth_sentiment = 0.4 * f_a50_morning + 0.6 * hxc_last_night</div>
                  <div className="text-slate-500">4: </div>
                  
                  {/* Rule 1: Collapse共振暴跌 */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${chinaAdvisorData.activeRule === 1 ? 'bg-rose-500/20 text-rose-350 border border-rose-500/40 ring-1 ring-rose-500/10' : 'text-slate-400'}`}>
                    <div>5:     <span className="text-blue-450 font-bold">if</span> f_a50_morning &lt;= -0.8 <span className="text-blue-450 font-bold">and</span> hxc_last_night &lt;= -1.5:</div>
                    <div className="pl-4">6:         <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"🔴 [严重警报] 大A与创业板今早将大幅低开！"</span>, <span className="text-amber-300">"场外禁止加仓..."</span></div>
                  </div>

                  {/* Rule 2: Bullish共振大涨 */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${chinaAdvisorData.activeRule === 2 ? 'bg-emerald-500/20 text-emerald-350 border border-emerald-500/40 ring-1 ring-emerald-500/10' : 'text-slate-400'}`}>
                    <div>7:     <span className="text-blue-450 font-bold">elif</span> f_a50_morning &gt;= +0.8 <span className="text-blue-450 font-bold">and</span> hxc_last_night &gt;= +1.5:</div>
                    <div className="pl-4">8:         <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"🟢 [多头逼空] 大A与创业板今早将大幅高开！"</span>, <span className="text-amber-300">"场内冲高切勿追..."</span></div>
                  </div>

                  {/* Rule 3: 二八结构分化 */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${chinaAdvisorData.activeRule === 3 ? 'bg-amber-500/20 text-amber-350 border border-amber-500/40 ring-1 ring-amber-500/10' : 'text-slate-400'}`}>
                    <div>9:     <span className="text-blue-450 font-bold">elif</span> f_a50_morning &gt;= +0.5 <span className="text-blue-450 font-bold">and</span> hxc_last_night &lt;= -1.0:</div>
                    <div className="pl-4">10:        <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"🟡 [二八分化] 传统蓝筹护盘，创业板承压！"</span>, <span className="text-amber-300">"蓝筹走强但科技走弱..."</span></div>
                  </div>

                  {/* Rule 4: 默认横向震荡 */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${chinaAdvisorData.activeRule === 4 ? 'bg-blue-500/20 text-blue-350 border border-blue-500/40 ring-1 ring-blue-500/10' : 'text-slate-400'}`}>
                    <div>11:    <span className="text-blue-450 font-bold">else</span>:</div>
                    <div className="pl-4">12:        <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"⚪ [震荡市]"</span>, <span className="text-amber-300">"大A大概率维持横向整理，继续坚守日常定投计划..."</span></div>
                  </div>
                </div>
              ) : (
                // US Python Code
                <div className="flex flex-col gap-0.5 select-text text-slate-400 font-mono">
                  <div className="text-slate-500">1: <span className="text-blue-450 font-bold">def</span> <span className="text-emerald-400 font-bold">generate_us_fund_signal</span>(f_nasdaq, f_sp500, has_macro_data=False):</div>
                  
                  {/* Rule 0: circuit breaker */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 0 ? 'bg-red-500/35 text-red-305 border border-red-500/50 ring-1 ring-red-500/10' : 'text-slate-400'}`}>
                    <div>2:     <span className="text-blue-450 font-bold">if</span> f_nasdaq &lt;= -5.0 <span className="text-blue-450 font-bold">or</span> f_sp500 &lt;= -5.0:</div>
                    <div className="pl-4">3:         <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"⚠️ EMERGENCY_STOP"</span>, <span className="text-amber-300">"🔥 期货盘前熔断！立刻申请赎回避险，禁止买入！"</span></div>
                  </div>

                  {/* Rule 1: Macro Data */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 1 ? 'bg-slate-500/30 text-slate-300 border border-slate-500/40 ring-1 ring-slate-500/10' : 'text-slate-400'}`}>
                    <div>4:     <span className="text-blue-450 font-bold">if</span> has_macro_data:</div>
                    <div className="pl-4">5:         <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"HOLD_REGULAR"</span>, <span className="text-amber-300">"⏳ 今晚有重大数据，下午期货走势极具欺骗性。不做调仓。"</span></div>
                  </div>

                  <div className="text-slate-500">6:     spread = abs(f_nasdaq - f_sp500)</div>
                  
                  {/* Rule 2: Short co-resonance */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 2 ? 'bg-rose-500/20 text-rose-350 border border-rose-500/40 ring-1 ring-rose-500/10' : 'text-slate-400'}`}>
                    <div>7:     <span className="text-blue-450 font-bold">if</span> f_nasdaq &lt;= -0.8 <span className="text-blue-450 font-bold">and</span> f_sp500 &lt;= -0.6 <span className="text-blue-450 font-bold">and</span> spread &lt;= 0.6:</div>
                    <div className="pl-4">8:         <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"SELL_OR_STOP_BUY"</span>, <span className="text-amber-300">"🔴 21:30低开。适合15:00前卖出止盈；买入执行暂停。"</span></div>
                  </div>

                  {/* Rule 3: Long co-resonance */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 3 ? 'bg-emerald-500/20 text-emerald-355 border border-emerald-500/40 ring-1 ring-emerald-500/10' : 'text-slate-400'}`}>
                    <div>9:     <span className="text-blue-450 font-bold">if</span> f_nasdaq &gt;= +0.8 <span className="text-blue-450 font-bold">and</span> f_sp500 &gt;= +0.5 <span className="text-blue-450 font-bold">and</span> spread &lt;= 0.6:</div>
                    <div className="pl-4">10:        <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"BUY_STRONG"</span>, <span className="text-amber-300">"🟢 21:30高开。逼空确立，适合15:00前加仓买入，直接收割涨幅。"</span></div>
                  </div>

                  {/* Rule 4: Noise or range bound - small changes */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 4 ? 'bg-blue-500/20 text-blue-350 border border-blue-500/40 ring-1 ring-blue-500/10' : 'text-slate-400'}`}>
                    <div>11:    <span className="text-blue-450 font-bold">if</span> abs(f_nasdaq) &lt; 0.5 <span className="text-blue-450 font-bold">and</span> abs(f_sp500) &lt; 0.5:</div>
                    <div className="pl-4">12:        <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"HOLD_REGULAR"</span>, <span className="text-amber-300">"⚪ 平开震荡，进入垃圾时间。下午走势无精准参考。维持常规。"</span></div>
                  </div>

                  {/* Rule 5: Noise or range bound - spread too high */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 5 ? 'bg-amber-500/20 text-amber-350 border border-amber-500/40 ring-1 ring-amber-500/10' : 'text-slate-400'}`}>
                    <div>13:    <span className="text-blue-450 font-bold">if</span> spread &gt; 1.2:</div>
                    <div className="pl-4">14:        <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"HOLD_REGULAR"</span>, <span className="text-amber-300">"🟡 剧烈洗盘。指数背离严重分化，信号失真。维持常规定投。"</span></div>
                  </div>

                  {/* Default fallback */}
                  <div className={`transition-all duration-300 py-0.5 px-2 rounded-md ${usAdvisorData.activeRule === 6 ? 'bg-slate-550/20 text-slate-350 border border-slate-550/30' : 'text-slate-400'}`}>
                    <div>15:    <span className="text-blue-450 font-bold">return</span> <span className="text-amber-300">"HOLD_REGULAR"</span>, <span className="text-amber-350">"执行默认日常计划。"</span></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Terminal status bar */}
            <div className="flex items-center justify-between text-[9px] text-slate-550 border-t border-slate-850 pt-2 font-bold select-none font-mono">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Sandbox Active</span>
              </span>
              <span>Lines: {advisorSubTab === 'china' ? '12' : '15'} • UTF-8 • PySparkle Compiler</span>
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-0 overflow-y-auto md:overflow-hidden pb-4 md:pb-0">

      
      {/* Left Area: Indices Card Grid (7/12 cols on desktop) */}
      <div className={`${marketTab === 'advisor' ? 'col-span-12' : 'col-span-1 md:col-span-7'} flex flex-col gap-4 min-h-[300px] md:h-full md:overflow-hidden`}>
        
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
            <button
              onClick={() => setMarketTab('advisor')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer relative ${
                marketTab === 'advisor'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/10'
                  : 'text-slate-500 hover:text-slate-805'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>双阈值投资助手</span>
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
          ) : marketTab === 'predictor' ? (
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
          ) : (
            renderQuantAdvisorView()
          )}
        </div>
      </div>

      {/* Right Area: Large Interactive Detailed ECharts Panel (5/12 cols on desktop) */}
      {marketTab !== 'advisor' && (
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
      )}

    </div>
  );
}
