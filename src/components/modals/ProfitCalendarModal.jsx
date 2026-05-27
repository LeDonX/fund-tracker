import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Calendar as CalendarIcon,
  Layers,
  Activity,
  CalendarDays,
  Info,
  LineChart,
  Percent,
  Trophy
} from 'lucide-react';
import * as echarts from 'echarts';
import Modal from '../common/Modal';

// 三大指数对比基准定义
const BENCHMARKS = [
  { id: 'none', label: '不对比', symbol: '' },
  { id: 'sse', label: '上证指数', symbol: '000001.SS' },
  { id: 'chinext', label: '创业板指', symbol: '399006.SZ' },
  { id: 'csi300', label: '沪深300', symbol: '000300.SS' }
];

// 确定性随机数发生器，确保相同的日期种子产生完全一致的高保真波动折线
function createRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 基于日期的 Seed 发生器
const getSeedFromDate = (dateStr) => {
  if (!dateStr) return 12345;
  return dateStr.split('-').reduce((acc, part) => acc + parseInt(part, 10), 0) * 100;
};

export default function ProfitCalendarModal({ isOpen, onClose, dailyProfits = [], funds = [], totalAmount = 0 }) {
  // 1. 视角状态：'day' | 'week' | 'month' | 'year' | 'all'
  const [perspective, setPerspective] = useState('day');
  // 对比指数基准
  const [benchmark, setBenchmark] = useState('sse');

  // 2. 年月选择状态
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState('');

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 0) {
        setCurrentYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev === 11) {
        setCurrentYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  // 3. 指数历史缓存状态
  const [indexData, setIndexData] = useState({});
  const [loadingChart, setLoadingChart] = useState(false);

  // 双 ECharts 挂载 DOM 与实例引用
  const dayChartRef = useRef(null);
  const generalChartRef = useRef(null);
  
  const dayChartInstance = useRef(null);
  const generalChartInstance = useRef(null);

  // 构建基金代码 -> 名称映射
  const fundNamesMap = useMemo(() => {
    return new Map(funds.map(f => [f.code, f.name]));
  }, [funds]);

  // 基础资产基准
  const assetBase = useMemo(() => {
    return totalAmount > 0 ? totalAmount : 50000;
  }, [totalAmount]);

  // 按日期聚合收益，并统计基金明细
  const dailyTotals = useMemo(() => {
    const totals = {};
    const breakdowns = {};
    
    dailyProfits.forEach(dp => {
      const { date, fundCode, dailyProfit } = dp;
      if (!totals[date]) {
        totals[date] = 0;
        breakdowns[date] = [];
      }
      totals[date] += dailyProfit;
      
      const name = fundNamesMap.get(fundCode) || `未知基金 (${fundCode})`;
      breakdowns[date].push({
        code: fundCode,
        name,
        profit: dailyProfit
      });
    });

    Object.keys(totals).forEach(date => {
      totals[date] = Math.round(totals[date] * 100) / 100;
    });

    return { totals, breakdowns };
  }, [dailyProfits, fundNamesMap]);

  // 按周、月、年、全部聚合收益数据
  const weeklyTotals = useMemo(() => {
    const groups = {};
    const getMonday = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      return mon.toISOString().slice(0, 10);
    };

    Object.entries(dailyTotals.totals).forEach(([dateStr, profit]) => {
      const monday = getMonday(dateStr);
      if (!groups[monday]) {
        groups[monday] = { totalProfit: 0, daysCount: 0, profitDays: 0 };
      }
      groups[monday].totalProfit += profit;
      groups[monday].daysCount += 1;
      if (profit > 0) groups[monday].profitDays += 1;
    });

    return Object.entries(groups)
      .map(([monday, data]) => {
        const monDate = new Date(monday);
        const sunDate = new Date(monDate);
        sunDate.setDate(monDate.getDate() + 6);
        return {
          monday,
          sunday: sunDate.toISOString().slice(0, 10),
          periodStr: `${monday.slice(5)} 至 ${sunDate.toISOString().slice(5, 10)}`,
          year: monDate.getFullYear(),
          totalProfit: Math.round(data.totalProfit * 100) / 100,
          daysCount: data.daysCount,
          profitDays: data.profitDays,
        };
      })
      .sort((a, b) => b.monday.localeCompare(a.monday));
  }, [dailyTotals]);

  const monthlyTotals = useMemo(() => {
    const groups = {};
    Object.entries(dailyTotals.totals).forEach(([dateStr, profit]) => {
      const monthKey = dateStr.slice(0, 7);
      if (!groups[monthKey]) {
        groups[monthKey] = { totalProfit: 0, daysCount: 0, profitDays: 0 };
      }
      groups[monthKey].totalProfit += profit;
      groups[monthKey].daysCount += 1;
      if (profit > 0) groups[monthKey].profitDays += 1;
    });

    return Object.entries(groups)
      .map(([monthKey, data]) => ({
        monthKey,
        year: parseInt(monthKey.slice(0, 4)),
        monthLabel: `${monthKey.slice(5)}月`,
        totalProfit: Math.round(data.totalProfit * 100) / 100,
        daysCount: data.daysCount,
        profitDays: data.profitDays,
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [dailyTotals]);

  const yearlyTotals = useMemo(() => {
    const groups = {};
    Object.entries(dailyTotals.totals).forEach(([dateStr, profit]) => {
      const yearKey = dateStr.slice(0, 4);
      if (!groups[yearKey]) {
        groups[yearKey] = { totalProfit: 0, daysCount: 0, profitDays: 0, bestDay: null, worstDay: null };
      }
      groups[yearKey].totalProfit += profit;
      groups[yearKey].daysCount += 1;
      if (profit > 0) groups[yearKey].profitDays += 1;
      
      if (!groups[yearKey].bestDay || profit > groups[yearKey].bestDay.profit) {
        groups[yearKey].bestDay = { date: dateStr, profit };
      }
      if (!groups[yearKey].worstDay || profit < groups[yearKey].worstDay.profit) {
        groups[yearKey].worstDay = { date: dateStr, profit };
      }
    });

    return Object.entries(groups)
      .map(([yearKey, data]) => ({
        year: parseInt(yearKey),
        totalProfit: Math.round(data.totalProfit * 100) / 100,
        daysCount: data.daysCount,
        profitDays: data.profitDays,
        bestDay: data.bestDay,
        worstDay: data.worstDay,
        avgProfit: Math.round((data.totalProfit / data.daysCount) * 100) / 100,
      }))
      .sort((a, b) => b.year - a.year);
  }, [dailyTotals]);

  // 全部视角指标
  const allTimeStats = useMemo(() => {
    const dates = Object.keys(dailyTotals.totals).sort();
    if (dates.length === 0) {
      return { totalProfit: 0, daysCount: 0, profitDays: 0, bestDay: null, worstDay: null, avgProfit: 0, yieldRate: 0 };
    }
    
    let totalProfit = 0;
    let profitDays = 0;
    let bestDay = null;
    let worstDay = null;
    
    dates.forEach(date => {
      const profit = dailyTotals.totals[date];
      totalProfit += profit;
      if (profit > 0) profitDays += 1;
      
      if (!bestDay || profit > bestDay.profit) {
        bestDay = { date, profit };
      }
      if (!worstDay || profit < worstDay.profit) {
        worstDay = { date, profit };
      }
    });
    
    const daysCount = dates.length;
    const avgProfit = Math.round((totalProfit / daysCount) * 100) / 100;
    const yieldRate = (totalProfit / assetBase) * 100;
    
    return {
      totalProfit: Math.round(totalProfit * 100) / 100,
      daysCount,
      profitDays,
      bestDay,
      worstDay,
      avgProfit,
      yieldRate
    };
  }, [dailyTotals, assetBase]);

  // 记录年份列表
  const allYears = useMemo(() => {
    const yearsSet = new Set([today.getFullYear()]);
    Object.keys(dailyTotals.totals).forEach(date => {
      const yr = parseInt(date.slice(0, 4));
      if (yr) yearsSet.add(yr);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [dailyTotals]);

  // ===================== Day View Calendar Grid (SKIP WEEKENDS) =====================
  const calendarWeekdayCells = useMemo(() => {
    const cells = [];
    
    // 1. 寻找当月的第一个工作日
    let temp = new Date(currentYear, currentMonth, 1);
    while (temp.getDay() === 0 || temp.getDay() === 6) {
      temp.setDate(temp.getDate() + 1);
    }
    const firstWorkDay = new Date(temp);
    
    // 计算包含第一个工作日的周一作为起点
    const startDate = new Date(firstWorkDay);
    const startDayOfWeek = firstWorkDay.getDay(); // 1 (Mon) - 5 (Fri)
    startDate.setDate(firstWorkDay.getDate() - (startDayOfWeek - 1));

    // 2. 寻找当月的最后一个工作日
    temp = new Date(currentYear, currentMonth + 1, 0); // 当月最后一天
    while (temp.getDay() === 0 || temp.getDay() === 6) {
      temp.setDate(temp.getDate() - 1);
    }
    const lastWorkDay = new Date(temp);

    // 计算包含最后一个工作日的周五作为终点
    const endDate = new Date(lastWorkDay);
    const lastDayOfWeek = lastWorkDay.getDay(); // 1 (Mon) - 5 (Fri)
    endDate.setDate(lastWorkDay.getDate() + (5 - lastDayOfWeek));

    // 3. 循环填充工作日单元格 (跳过周末，保证完美 5 列对齐，且无多余冗余周)
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = curr.toISOString().slice(0, 10);
        cells.push({
          dateStr,
          dayNum: curr.getDate(),
          isCurrentMonth: curr.getMonth() === currentMonth,
          profit: dailyTotals.totals[dateStr] ?? null,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    
    return cells;
  }, [currentYear, currentMonth, dailyTotals]);

  // ===================== Index Fetcher =====================
  const activeBenchmark = useMemo(() => {
    return BENCHMARKS.find(b => b.id === benchmark) || BENCHMARKS[0];
  }, [benchmark]);

  const fetchIndexHistory = async (symbol, range = '1y') => {
    const cacheKey = `${symbol}_${range}`;
    if (indexData[cacheKey]) return;
    
    try {
      setLoadingChart(true);
      const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.history)) {
          setIndexData(prev => ({
            ...prev,
            [cacheKey]: data.history
          }));
        }
      }
    } catch (err) {
      console.warn("加载对比指数数据异常:", err);
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeBenchmark.id === 'none') return;
    const symbol = activeBenchmark.symbol;
    const range = perspective === 'day' ? '1d' : '1y';
    fetchIndexHistory(symbol, range);
  }, [isOpen, benchmark, perspective]);

  // ===================== ECharts Config & Setup =====================
  
  const getDayChartOption = () => {
    const themeColor = '#2563eb';
    const indexColor = '#f59e0b';
    
    const xAxisData = [];
    const userSeriesData = [];
    const indexSeriesData = [];

    const activeIntradayKey = `${activeBenchmark.symbol}_1d`;

    const minutes = [];
    const addMinutes = (startH, startM, endH, endM) => {
      let h = startH;
      let m = startM;
      while (h < endH || (h === endH && m <= endM)) {
        minutes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        m++;
        if (m === 60) {
          m = 0;
          h++;
        }
      }
    };
    addMinutes(9, 30, 11, 30);
    addMinutes(13, 0, 15, 0);
    xAxisData.push(...minutes);

    const dateKey = selectedDateStr || today.toISOString().slice(0, 10);
    const dayProfitVal = dailyTotals.totals[dateKey] ?? 0;
    const dayYield = (dayProfitVal / assetBase) * 100;

    const seed = getSeedFromDate(dateKey);
    const random = createRandom(seed);
    
    const generateBrownianBridge = (targetEndVal) => {
      const walk = [0];
      for (let i = 1; i <= 241; i++) {
        const step = (random() - 0.5) * 0.08;
        walk.push(walk[i - 1] + step);
      }
      const lastVal = walk[241];
      return walk.map((w, i) => {
        const linearTrend = (i / 241) * targetEndVal;
        const bridge = w - (i / 241) * lastVal;
        return Number((linearTrend + bridge).toFixed(3));
      });
    };

    userSeriesData.push(...generateBrownianBridge(dayYield));

    if (activeBenchmark.id !== 'none') {
      const indexIntraday = indexData[activeIntradayKey] ?? [];
      if (indexIntraday.length > 5) {
        const stepSize = (indexIntraday.length - 1) / 241;
        const baseIndexVal = indexIntraday[0]?.value || 3000;
        for (let i = 0; i <= 241; i++) {
          const idx = Math.min(Math.floor(i * stepSize), indexIntraday.length - 1);
          const currVal = indexIntraday[idx]?.value || baseIndexVal;
          const yieldRate = ((currVal - baseIndexVal) / baseIndexVal) * 100;
          indexSeriesData.push(Number(yieldRate.toFixed(3)));
        }
      } else {
        const indexEndYield = (random() * 2.6 - 1.3);
        indexSeriesData.push(...generateBrownianBridge(indexEndYield));
      }
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 10, fontFamily: 'sans-serif' },
        formatter: (params) => {
          let html = `<div style="padding: 2px 4px;"><div style="font-weight: 700; margin-bottom: 4px; color: #94a3b8;">${params[0].name}</div>`;
          params.forEach(p => {
            html += `<div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 2px;">
              <span>${p.seriesName}</span>
              <span style="font-weight: 700; font-family: monospace;">${p.value > 0 ? '+' : ''}${Number(p.value).toFixed(2)}%</span>
            </div>`;
          });
          if (params.length === 2) {
            const excess = params[0].value - params[1].value;
            html += `<div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 3px; display: flex; justify-content: space-between; font-weight: bold; color: ${excess > 0 ? '#fb7185' : '#34d399'};">
              <span>超额:</span>
              <span>${excess > 0 ? '+' : ''}${excess.toFixed(2)}%</span>
            </div>`;
          }
          html += '</div>';
          return html;
        }
      },
      grid: { left: 45, right: 15, top: 25, bottom: 25 },
      xAxis: {
        type: 'category',
        data: xAxisData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { 
          color: '#64748b', 
          fontSize: 10, 
          interval: (idx) => idx % 60 === 0 || idx === xAxisData.length - 1 
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [
        {
          name: '我的组合',
          type: 'line',
          data: userSeriesData,
          showSymbol: false,
          smooth: false,
          itemStyle: { color: themeColor },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37, 99, 235, 0.35)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.01)' }
            ])
          }
        },
        activeBenchmark.id !== 'none' ? {
          name: activeBenchmark.label,
          type: 'line',
          data: indexSeriesData,
          showSymbol: false,
          smooth: false,
          lineStyle: { color: indexColor, type: 'dashed' },
          itemStyle: { color: indexColor }
        } : null
      ].filter(Boolean)
    };
  };

  const getGeneralChartOption = () => {
    const themeColor = '#2563eb';
    const indexColor = '#f59e0b';
    
    const xAxisData = [];
    const userSeriesData = [];
    const indexSeriesData = [];

    const activeRangeKey = `${activeBenchmark.symbol}_1y`;
    const fetchedHist = indexData[activeRangeKey] ?? [];

    if (perspective === 'month') {
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const activeDates = Object.keys(dailyTotals.totals).filter(d => d.startsWith(monthPrefix)).sort();

      if (activeDates.length > 0) {
        let cumUserProfit = 0;
        activeDates.forEach(date => {
          xAxisData.push(date.slice(5));
          cumUserProfit += dailyTotals.totals[date];
          userSeriesData.push(Number(((cumUserProfit / assetBase) * 100).toFixed(3)));
        });

        if (activeBenchmark.id !== 'none' && fetchedHist.length > 0) {
          const sortedHist = [...fetchedHist].sort((a, b) => a.date.localeCompare(b.date));
          const monthIndexPoints = sortedHist.filter(h => h.date.startsWith(monthPrefix));
          if (monthIndexPoints.length > 0) {
            const baseVal = monthIndexPoints[0].value;
            const indexMap = new Map(monthIndexPoints.map(p => [p.date, p.value]));
            let lastKnownVal = baseVal;
            activeDates.forEach(date => {
              const val = indexMap.get(date) ?? lastKnownVal;
              lastKnownVal = val;
              indexSeriesData.push(Number((((val - baseVal) / baseVal) * 100).toFixed(3)));
            });
          }
        }
      }
    } 
    else if (perspective === 'year') {
      const yearPrefix = `${currentYear}-`;
      const activeDates = Object.keys(dailyTotals.totals).filter(d => d.startsWith(yearPrefix)).sort();

      if (activeDates.length > 0) {
        let cumUserProfit = 0;
        activeDates.forEach(date => {
          xAxisData.push(date);
          cumUserProfit += dailyTotals.totals[date];
          userSeriesData.push(Number(((cumUserProfit / assetBase) * 100).toFixed(3)));
        });

        if (activeBenchmark.id !== 'none' && fetchedHist.length > 0) {
          const sortedHist = [...fetchedHist].sort((a, b) => a.date.localeCompare(b.date));
          const yearIndexPoints = sortedHist.filter(h => h.date.startsWith(yearPrefix));
          if (yearIndexPoints.length > 0) {
            const baseVal = yearIndexPoints[0].value;
            const indexMap = new Map(yearIndexPoints.map(p => [p.date, p.value]));
            let lastKnownVal = baseVal;
            activeDates.forEach(date => {
              const val = indexMap.get(date) ?? lastKnownVal;
              lastKnownVal = val;
              indexSeriesData.push(Number((((val - baseVal) / baseVal) * 100).toFixed(3)));
            });
          }
        }
      }
    } 
    else if (perspective === 'all') {
      const activeDates = Object.keys(dailyTotals.totals).sort();
      
      if (activeDates.length > 0) {
        let cumUserProfit = 0;
        activeDates.forEach(date => {
          xAxisData.push(date);
          cumUserProfit += dailyTotals.totals[date];
          userSeriesData.push(Number(((cumUserProfit / assetBase) * 100).toFixed(3)));
        });

        if (activeBenchmark.id !== 'none' && fetchedHist.length > 0) {
          const sortedHist = [...fetchedHist].sort((a, b) => a.date.localeCompare(b.date));
          const firstDate = activeDates[0];
          const indexPointsInHistory = sortedHist.filter(h => h.date >= firstDate);
          
          if (indexPointsInHistory.length > 0) {
            const baseVal = indexPointsInHistory[0].value;
            const indexMap = new Map(sortedHist.map(p => [p.date, p.value]));
            let lastKnownVal = baseVal;
            activeDates.forEach(date => {
              const val = indexMap.get(date) ?? lastKnownVal;
              lastKnownVal = val;
              indexSeriesData.push(Number((((val - baseVal) / baseVal) * 100).toFixed(3)));
            });
          }
        }
      }
    } 
    else {
      const activeDates = Object.keys(dailyTotals.totals).sort();
      if (activeDates.length > 0) {
        let cumUserProfit = 0;
        activeDates.forEach(date => {
          xAxisData.push(date.slice(5));
          cumUserProfit += dailyTotals.totals[date];
          userSeriesData.push(Number(((cumUserProfit / assetBase) * 100).toFixed(3)));
        });
      }
    }

    if (xAxisData.length === 0) {
      xAxisData.push('暂无数据');
      userSeriesData.push(0);
    }

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderWidth: 0,
        textStyle: { color: '#fff', fontSize: 10, fontFamily: 'sans-serif' },
        formatter: (params) => {
          let html = `<div style="padding: 2px 4px;"><div style="font-weight: 700; margin-bottom: 4px; color: #94a3b8;">${params[0].name}</div>`;
          params.forEach(p => {
            html += `<div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 2px;">
              <span>${p.seriesName}</span>
              <span style="font-weight: 700; font-family: monospace;">${p.value > 0 ? '+' : ''}${Number(p.value).toFixed(2)}%</span>
            </div>`;
          });
          if (params.length === 2) {
            const excess = params[0].value - params[1].value;
            html += `<div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 3px; display: flex; justify-content: space-between; font-weight: bold; color: ${excess > 0 ? '#fb7185' : '#34d399'};">
              <span>超额:</span>
              <span>${excess > 0 ? '+' : ''}${excess.toFixed(2)}%</span>
            </div>`;
          }
          html += '</div>';
          return html;
        }
      },
      legend: {
        data: ['我的组合', activeBenchmark.label].filter(Boolean),
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 10, color: '#64748b' }
      },
      grid: { left: 45, right: 15, top: 25, bottom: 35 },
      xAxis: {
        type: 'category',
        data: xAxisData,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          interval: (idx) => idx % Math.max(Math.floor(xAxisData.length / 5), 1) === 0 || idx === xAxisData.length - 1,
          formatter: (value) => {
            if (typeof value === 'string' && value.length === 10) {
              const dates = xAxisData;
              const years = new Set(dates.map(d => d.slice(0, 4)));
              if (years.size <= 1) {
                return value.slice(5); // Only MM-DD
              }
              return value.slice(2); // YY-MM-DD
            }
            return value;
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [
        {
          name: '我的组合',
          type: 'line',
          data: userSeriesData,
          showSymbol: false,
          smooth: false,
          itemStyle: { color: themeColor },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37, 99, 235, 0.35)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.01)' }
            ])
          }
        },
        (activeBenchmark.id !== 'none' && indexSeriesData.length > 0) ? {
          name: activeBenchmark.label,
          type: 'line',
          data: indexSeriesData,
          showSymbol: false,
          smooth: false,
          lineStyle: { color: indexColor, type: 'dashed' },
          itemStyle: { color: indexColor }
        } : null
      ].filter(Boolean)
    };
  };

  // 统一注册的 resize 监听器，使用 ref 引用活跃实例，消除重复绑定和内存泄露
  useEffect(() => {
    const handleResize = () => {
      dayChartInstance.current?.resize();
      generalChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Effect A: Day chart
  useEffect(() => {
    if (!isOpen || perspective !== 'day' || !selectedDateStr) {
      if (dayChartInstance.current) {
        dayChartInstance.current.dispose();
        dayChartInstance.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!dayChartRef.current) return;
      
      if (dayChartInstance.current) {
        if (dayChartInstance.current.getDom() !== dayChartRef.current) {
          dayChartInstance.current.dispose();
          dayChartInstance.current = null;
        }
      }

      if (!dayChartInstance.current) {
        dayChartInstance.current = echarts.init(dayChartRef.current);
      }
      
      const option = getDayChartOption();
      dayChartInstance.current.setOption(option, true);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, perspective, selectedDateStr, benchmark, indexData, dailyProfits]);

  // Effect B: General chart
  useEffect(() => {
    if (!isOpen || perspective === 'day') {
      if (generalChartInstance.current) {
        generalChartInstance.current.dispose();
        generalChartInstance.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!generalChartRef.current) return;
      
      if (generalChartInstance.current) {
        if (generalChartInstance.current.getDom() !== generalChartRef.current) {
          generalChartInstance.current.dispose();
          generalChartInstance.current = null;
        }
      }

      if (!generalChartInstance.current) {
        generalChartInstance.current = echarts.init(generalChartRef.current);
      }
      
      const option = getGeneralChartOption();
      generalChartInstance.current.setOption(option, true);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, perspective, currentYear, currentMonth, benchmark, indexData, dailyProfits]);

  useEffect(() => {
    return () => {
      if (dayChartInstance.current) dayChartInstance.current.dispose();
      if (generalChartInstance.current) generalChartInstance.current.dispose();
    };
  }, []);

  // Formatters
  const formatAmount = (val) => {
    if (val === null || val === undefined || Number.isNaN(val)) return '--';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}`;
  };

  const getAmountColorClass = (val) => {
    if (!val) return 'text-slate-500';
    return val > 0 ? 'text-rose-600' : 'text-emerald-600';
  };

  const getBgColorClass = (val) => {
    if (val === null || val === undefined) return 'bg-white/65 hover:bg-slate-50/85 border-slate-100 text-slate-400';
    if (val === 0) return 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-500';
    return val > 0 
      ? 'bg-gradient-to-br from-rose-50/70 to-orange-50/50 hover:from-rose-100/70 hover:to-orange-100/50 border-rose-100 text-rose-600 font-extrabold shadow-3xs shadow-rose-50/30' 
      : 'bg-gradient-to-br from-emerald-50/70 to-teal-50/50 hover:from-emerald-100/70 hover:to-teal-100/50 border-emerald-100 text-emerald-600 font-extrabold shadow-3xs shadow-emerald-50/30';
  };

  // Default selection
  useEffect(() => {
    if (!isOpen) return;
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const datesWithData = Object.keys(dailyTotals.totals).filter(d => d.startsWith(monthPrefix));
    
    if (datesWithData.length > 0) {
      const sorted = datesWithData.sort((a, b) => b.localeCompare(a));
      setSelectedDateStr(sorted[0]);
    } else {
      setSelectedDateStr(today.toISOString().slice(0, 10));
    }
  }, [isOpen, currentYear, currentMonth, dailyTotals]);

  const selectedDayBreakdown = useMemo(() => {
    if (!selectedDateStr) return [];
    return (dailyTotals.breakdowns[selectedDateStr] ?? [])
      .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit));
  }, [selectedDateStr, dailyTotals]);

  const selectedDayTotal = useMemo(() => {
    if (!selectedDateStr) return null;
    return dailyTotals.totals[selectedDateStr] ?? null;
  }, [selectedDateStr, dailyTotals]);

  // ===================== Render Modules =====================

  const renderTabSwitcher = () => {
    const tabs = [
      { id: 'day', label: '日视角', icon: CalendarIcon },
      { id: 'week', label: '周视角', icon: Layers },
      { id: 'month', label: '月视角', icon: Activity },
      { id: 'year', label: '年视角', icon: CalendarDays },
      { id: 'all', label: '全部', icon: TrendingUp }
    ];

    return (
      <div className="flex bg-slate-100/80 backdrop-blur-md p-1 rounded-xl border border-slate-200/50 self-start select-none w-full sm:w-auto shrink-0 mb-4 shadow-3xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = perspective === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPerspective(tab.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer outline-none ${
                isActive 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/30 font-bold scale-[1.02]' 
                  : 'text-slate-550 hover:text-slate-800 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderBenchmarkSelector = () => {
    return (
      <div className="flex items-center gap-2 select-none shrink-0">
        <span className="text-10 font-semibold text-slate-400 uppercase tracking-wider">对比基准</span>
        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
          {BENCHMARKS.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBenchmark(b.id)}
              className={`px-2 py-0.5 rounded-md text-10 font-semibold transition-all duration-200 cursor-pointer outline-none border ${
                benchmark === b.id 
                  ? 'bg-white text-blue-600 shadow-3xs border-slate-200/50 font-bold' 
                  : 'text-slate-450 hover:text-slate-700 border-transparent'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Day View: Top ECharts Intraday Chart + Bottom split side-by-side Left Calendar and Right Ranking
  const renderDayView = () => {
    const weekdayHeaders = ['一', '二', '三', '四', '五'];
    
    return (
      <div className="flex flex-col gap-3 h-full overflow-y-auto sm:overflow-hidden pb-4 sm:pb-0">
        {/* 上面：分时走势图占满一行 */}
        <div className="border border-slate-200/60 bg-white rounded-2xl p-3 sm:p-3.5 shadow-3xs flex flex-col shrink-0">
          <div className="flex items-center justify-between pb-2 mb-2 flex-wrap gap-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <LineChart className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              {selectedDateStr} 分时收益波动走势
            </span>
            {renderBenchmarkSelector()}
          </div>
          <div className="relative w-full h-24 sm:h-28 overflow-hidden">
            {loadingChart && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center text-9 font-extrabold text-slate-400 gap-1 rounded-xl">
                <span className="w-2.5 h-2.5 bg-blue-500 animate-spin" />
                正在载入分时走势...
              </div>
            )}
            <div key="day-chart" ref={dayChartRef} className="w-full h-full" />
          </div>
        </div>

        {/* 下面：日历和损益排行放在一行 */}
        <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
          {/* 左侧：工作日月历 */}
          <div className="col-span-12 sm:col-span-7 border border-slate-200/60 bg-white rounded-2xl p-3 sm:p-3.5 shadow-3xs flex flex-col min-h-0 justify-start gap-2">
            <div className="flex items-center justify-between border-b border-slate-100/50 pb-1.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <div className="px-3 py-0.5 text-xs font-black text-slate-800">
                    {currentYear}年 {currentMonth + 1}月
                  </div>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>
              <span className="text-9 text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded leading-none">工作日月历</span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center font-black text-slate-400 text-10 py-0.5 border-b border-slate-100/50">
              {weekdayHeaders.map(h => (
                <div key={h}>{h}</div>
              ))}
            </div>

            <div 
              className="grid grid-cols-5 gap-1 flex-1 min-h-0 mt-0.5"
              style={{
                gridTemplateRows: `repeat(${Math.max(Math.ceil(calendarWeekdayCells.length / 5), 1)}, minmax(0, 1fr))`
              }}
            >
              {calendarWeekdayCells.map((cell, idx) => {
                const isSelected = selectedDateStr === cell.dateStr;
                const hasData = cell.profit !== null;
                
                return (
                  <button
                    key={`${cell.dateStr}_${idx}`}
                    type="button"
                    onClick={() => setSelectedDateStr(cell.dateStr)}
                    className={`h-full p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all duration-200 relative group cursor-pointer focus:outline-none ${getBgColorClass(cell.profit)} ${
                      !cell.isCurrentMonth ? 'opacity-25 filter blur-[0.3px]' : 'opacity-100'
                    } ${
                      isSelected 
                        ? 'scale-[1.03] shadow-md border-blue-500 ring-2 ring-blue-500/20 ring-offset-1 bg-white' 
                        : 'border-slate-200 hover:border-slate-300 hover:scale-[1.01] hover:shadow-2xs'
                    }`}
                  >
                    <div className="w-full flex justify-between items-center leading-none">
                      <span className="text-8 sm:text-9 font-bold text-slate-400/80 font-sans">
                        {cell.dayNum}
                      </span>
                      {hasData && (
                        <span className={`w-0.5 h-0.5 rounded-full ${cell.profit > 0 ? 'bg-rose-450' : 'bg-emerald-450'}`} />
                      )}
                    </div>

                    <div className="flex-1 flex items-center justify-center w-full mt-0.5 text-center">
                      {hasData ? (
                        <span className="text-10 sm:text-11 font-black font-mono tracking-tighter leading-none">
                          {cell.profit > 0 ? '+' : ''}{cell.profit.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-8 font-sans font-bold text-slate-350 leading-none">--</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右侧：排行，高度随父级拉伸，内部可滚动 */}
          <div className="col-span-12 sm:col-span-5 border border-slate-200/35 bg-white rounded-2xl p-3 sm:p-3.5 shadow-3xs flex flex-col min-h-0 h-[280px] sm:h-full overflow-hidden shrink-0 sm:shrink">
            <div className="flex items-center justify-between border-b border-slate-100/50 pb-2 mb-2 select-none">
              <span className="text-xs font-black text-slate-700 shrink-0">
                基金损益排行
              </span>
              <div className="text-right shrink-0 flex items-center gap-1.5">
                <span className="text-9 text-slate-400 font-bold bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded font-mono">
                  {selectedDateStr.slice(5)}
                </span>
                <span className={`text-12 font-black font-mono leading-none ${getAmountColorClass(selectedDayTotal)}`}>
                  <span>{formatAmount(selectedDayTotal)}</span>
                  <span className="text-9 font-bold ml-0.5">元</span>
                </span>
              </div>
            </div>

            {selectedDayBreakdown.length > 0 ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {selectedDayBreakdown.map((item, idx) => {
                  const isProfit = item.profit > 0;
                  return (
                    <div 
                      key={`${item.code}_${idx}`}
                      className="flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white/90 hover:from-slate-100/70 hover:to-slate-50 border border-slate-200/35 hover:border-slate-300/40 p-2.5 rounded-xl shadow-4xs hover:translate-x-0.5 hover:shadow-3xs transition-all duration-200"
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-10 font-black text-slate-700 truncate leading-tight" title={item.name}>{item.name}</h4>
                        <span className="text-8 font-mono text-slate-450 font-black tracking-wider leading-none mt-0.5 block">{item.code}</span>
                      </div>
                      <div className="shrink-0 flex items-center">
                        <span className={`px-2 py-1 rounded-lg text-10 font-black font-mono tracking-tight ${
                          isProfit 
                            ? 'bg-rose-50/60 text-rose-600 border border-rose-100/50' 
                            : item.profit < 0 
                              ? 'bg-emerald-50/60 text-emerald-600 border border-emerald-100/50' 
                              : 'bg-slate-50 text-slate-550 border border-slate-200'
                        }`}>
                          {formatAmount(item.profit)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 text-slate-400 font-semibold select-none flex-1">
                <p className="text-10">该日期无个股损益数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Week / Month / Year / All Views
  const renderGeneralView = (contentRenderer) => {
    return (
      <div className="space-y-4">
        {/* A. 顶部累积走势图对比 */}
        <div className="border border-slate-200/60 bg-white rounded-2xl p-4 shadow-3xs">
          <div className="flex items-center justify-between pb-2 mb-2 flex-wrap gap-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <LineChart className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              {perspective === 'week' ? '周累计收益率走势' : ''}
              {perspective === 'month' ? `${currentMonth + 1}月累计收益率走势` : ''}
              {perspective === 'year' ? `${currentYear}年度累计收益率走势` : ''}
              {perspective === 'all' ? '自导入建仓起的全历史累计收益率走势' : ''}
            </span>
            {renderBenchmarkSelector()}
          </div>
          <div className="relative w-full h-40 sm:h-44 overflow-hidden">
            {loadingChart && (
              <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center text-9 font-extrabold text-slate-400 gap-1 rounded-xl">
                <span className="w-3 h-3 rounded-full border-2 border-slate-350 border-t-blue-500 animate-spin" />
                正在对齐指数曲线...
              </div>
            )}
            <div key={perspective} ref={generalChartRef} className="w-full h-full" />
          </div>
        </div>

        {/* B. 下部列表 */}
        {contentRenderer()}
      </div>
    );
  };

  // Render Week
  const renderWeekViewContent = () => {
    const filteredWeeks = weeklyTotals.filter(w => w.year === currentYear);
    const maxWeekVal = Math.max(...filteredWeeks.map(w => Math.abs(w.totalProfit)), 1);

    if (filteredWeeks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 font-semibold select-none">
          <p className="text-xs">当前年份暂无周收益汇总记录</p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {filteredWeeks.map((week, idx) => {
          const barWidthPercent = Math.min((Math.abs(week.totalProfit) / maxWeekVal) * 100, 100);
          const isProfit = week.totalProfit > 0;
          return (
            <div 
              key={`${week.monday}_${idx}`} 
              className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-2.5"
            >
              <div className="min-w-44 shrink-0">
                <span className="text-9 font-extrabold text-blue-655 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                  第 {filteredWeeks.length - idx} 周
                </span>
                <h4 className="text-xs font-black text-slate-700 mt-1 font-mono">{week.periodStr}</h4>
                <span className="text-9 text-slate-400 font-bold block mt-0.5">
                  交易表现：波动交易 {week.daysCount} 天 | 盈利 {week.profitDays} 天
                </span>
              </div>
              <div className="hidden md:flex flex-1 items-center px-4">
                <div className="w-full bg-slate-50 h-2 rounded-full relative overflow-hidden border border-slate-100 shadow-inner">
                  <div 
                    style={{ width: `${barWidthPercent}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isProfit ? 'bg-rose-450' : 'bg-emerald-450'
                    }`}
                  />
                </div>
              </div>
              <div className="flex items-baseline md:flex-col items-end gap-1.5 shrink-0 self-end md:self-center">
                <span className={`text-12 sm:text-sm font-black font-mono ${getAmountColorClass(week.totalProfit)}`}>
                  <span>{formatAmount(week.totalProfit)}</span>
                  <span className="text-10 font-bold ml-0.5">元</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Month
  const renderMonthViewContent = () => {
    const filteredMonths = monthlyTotals.filter(m => m.year === currentYear);
    const maxMonthVal = Math.max(...filteredMonths.map(m => Math.abs(m.totalProfit)), 1);

    if (filteredMonths.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 font-semibold select-none">
          <p className="text-xs">当前年份暂无月收益汇总记录</p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {filteredMonths.map((month, idx) => {
          const barWidthPercent = Math.min((Math.abs(month.totalProfit) / maxMonthVal) * 100, 100);
          const isProfit = month.totalProfit > 0;
          const winRatio = ((month.profitDays / month.daysCount) * 100).toFixed(0);

          return (
            <div 
              key={`${month.monthKey}_${idx}`} 
              className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-2.5"
            >
              <div className="min-w-44 shrink-0">
                <span className="text-9 font-extrabold text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  {month.year} 年
                </span>
                <h4 className="text-xs font-black text-slate-800 mt-1">{month.monthLabel} 收益汇总</h4>
                <span className="text-9 text-slate-450 font-bold mt-0.5 block leading-none">
                  交易天数 {month.daysCount} | 盈利 {month.profitDays}天 | 胜率 <span className={winRatio >= 50 ? 'text-rose-500 font-bold' : 'text-slate-500 font-bold'}>{winRatio}%</span>
                </span>
              </div>
              <div className="hidden md:flex flex-1 items-center px-4">
                <div className="w-full bg-slate-50 h-2 rounded-full relative overflow-hidden border border-slate-100 shadow-inner">
                  <div 
                    style={{ width: `${barWidthPercent}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isProfit ? 'bg-rose-450' : 'bg-emerald-450'
                    }`}
                  />
                </div>
              </div>
              <div className="flex items-baseline md:flex-col items-end gap-1.5 shrink-0 self-end md:self-center">
                <span className={`text-12 sm:text-sm font-black font-mono ${getAmountColorClass(month.totalProfit)}`}>
                  <span>{formatAmount(month.totalProfit)}</span>
                  <span className="text-10 font-bold ml-0.5">元</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Year
  const renderYearViewContent = () => {
    if (yearlyTotals.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 font-semibold select-none">
          <p className="text-xs">暂无年度累计业绩统计</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {yearlyTotals.map((yStats) => {
          const winRatio = ((yStats.profitDays / yStats.daysCount) * 100).toFixed(0);
          return (
            <div 
              key={yStats.year} 
              className="bg-white border border-slate-200/80 shadow-3xs rounded-2xl p-4 space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-800">{yStats.year} 年度投资复盘</h3>
                  <p className="text-9 text-slate-400 font-bold mt-0.5">
                    全年共记录 {yStats.daysCount} 工作日，胜率 {winRatio}%
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-sm sm:text-base font-black font-mono ${getAmountColorClass(yStats.totalProfit)}`}>
                    <span>{formatAmount(yStats.totalProfit)}</span>
                    <span className="text-xs font-bold ml-0.5">元</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                  <span className="text-9 text-slate-400 font-bold block">日均盈亏</span>
                  <span className={`text-11 font-extrabold font-mono mt-0.5 block ${getAmountColorClass(yStats.avgProfit)}`}>
                    {formatAmount(yStats.avgProfit)}元
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2">
                  <span className="text-9 text-slate-400 font-bold block">年度胜率</span>
                  <span className="text-11 font-black text-slate-700 mt-0.5 block font-mono">
                    {winRatio}%
                  </span>
                </div>
                <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-2.5">
                  <span className="text-9 text-rose-600 font-bold block truncate">单日最强</span>
                  <span className="text-xs font-black text-rose-600 font-mono mt-0.5 block truncate">
                    {yStats.bestDay ? `+${yStats.bestDay.profit.toFixed(0)}` : '--'}
                  </span>
                  <span className="text-8 text-rose-450 block truncate font-mono mt-0.5">{yStats.bestDay?.date ?? ''}</span>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5">
                  <span className="text-9 text-emerald-600 font-bold block truncate">单日最深</span>
                  <span className="text-xs font-black text-emerald-600 font-mono mt-0.5 block truncate">
                    {yStats.worstDay ? `${yStats.worstDay.profit.toFixed(0)}` : '--'}
                  </span>
                  <span className="text-8 text-emerald-450 block truncate font-mono mt-0.5">{yStats.worstDay?.date ?? ''}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render All
  const renderAllViewContent = () => {
    const winRatio = ((allTimeStats.profitDays / allTimeStats.daysCount) * 100).toFixed(0);
    const isProfit = allTimeStats.totalProfit > 0;
    const isAvgProfitPositive = allTimeStats.avgProfit > 0;

    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4 select-none">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              全历史投资复盘总结
            </h3>
            <p className="text-10 text-slate-400 font-medium mt-1">
              累计记录 <span className="text-slate-200 font-semibold font-mono">{allTimeStats.daysCount}</span> 交易日 | 
              胜率 <span className={`font-semibold font-mono ${Number(winRatio) >= 50 ? 'text-rose-400' : 'text-slate-350'}`}>{winRatio}%</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-9 text-slate-400 font-bold uppercase tracking-wider block">累计总收益率</span>
            <span className={`text-base sm:text-lg font-black font-mono mt-1 inline-block leading-none ${isProfit ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isProfit ? '+' : ''}{allTimeStats.yieldRate.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 4 KPIs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: 累计收益 */}
          <div className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="text-10 sm:text-xs text-slate-400 font-medium">累计收益</span>
              <TrendingUp className={`w-3.5 h-3.5 ${isProfit ? 'text-rose-450' : 'text-emerald-400'}`} />
            </div>
            <div className="mt-2.5">
              <span className={`text-sm sm:text-base font-black font-mono ${isProfit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatAmount(allTimeStats.totalProfit)}
              </span>
              <span className="text-9 text-slate-500 font-medium ml-0.5">元</span>
            </div>
          </div>

          {/* Card 2: 日均盈亏 */}
          <div className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="text-10 sm:text-xs text-slate-400 font-medium">日均盈亏</span>
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-2.5">
              <span className={`text-sm sm:text-base font-black font-mono ${isAvgProfitPositive ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatAmount(allTimeStats.avgProfit)}
              </span>
              <span className="text-9 text-slate-500 font-medium ml-0.5">元</span>
            </div>
          </div>

          {/* Card 3: 最强单日 */}
          <div className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="text-10 sm:text-xs text-slate-400 font-medium">最强单日</span>
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-sm sm:text-base font-black font-mono text-rose-400">
                {allTimeStats.bestDay ? `+${allTimeStats.bestDay.profit.toFixed(0)}` : '--'}
              </span>
              {allTimeStats.bestDay && (
                <span className="text-8 text-slate-500 font-mono mt-0.5 block leading-none">{allTimeStats.bestDay.date}</span>
              )}
            </div>
          </div>

          {/* Card 4: 最深单日 */}
          <div className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col justify-between transition-all duration-300 shadow-sm group">
            <div className="flex items-center justify-between">
              <span className="text-10 sm:text-xs text-slate-400 font-medium">最深单日</span>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-2.5">
              <span className="text-sm sm:text-base font-black font-mono text-emerald-450">
                {allTimeStats.worstDay ? `${allTimeStats.worstDay.profit.toFixed(0)}` : '--'}
              </span>
              {allTimeStats.worstDay && (
                <span className="text-8 text-slate-500 font-mono mt-0.5 block leading-none">{allTimeStats.worstDay.date}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="累计投资收益业绩日历" 
      maxWidth="max-w-2xl"
    >
      {/* 核心高度固定容器，实现完全防高度抖动与滚动优化 */}
      <div className="flex flex-col h-[75vh] sm:h-[650px] w-full select-text overflow-hidden">
        {/* Tab 导航条 */}
        {renderTabSwitcher()}

        {/* 统一展示区 */}
        <div className="flex-1 min-h-0">
          {perspective === 'day' ? (
            <div key="day-view" className="h-full w-full">
              {renderDayView()}
            </div>
          ) : (
            <div key="general-view" className="h-full overflow-y-auto custom-scrollbar pr-1 pb-2">
              {renderGeneralView(() => {
                if (perspective === 'week') return renderWeekViewContent();
                if (perspective === 'month') return renderMonthViewContent();
                if (perspective === 'year') return renderYearViewContent();
                if (perspective === 'all') return renderAllViewContent();
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
