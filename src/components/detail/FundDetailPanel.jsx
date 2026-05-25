import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import FormatNumber from '../common/FormatNumber';

const formatCurrencyAmount = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPlainNumber = (value, suffix = '') => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
};

const formatDayCount = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `${value} 天`;
};

const getTencentSymbol = (code) => {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return '';

  // Check if it is a US stock (has letters)
  if (/[A-Z]/.test(cleanCode)) {
    return `us${cleanCode}`;
  }

  // Check if it is a Hong Kong stock
  if (cleanCode.length === 5) {
    return `hk${cleanCode}`;
  }
  if (cleanCode.length < 5) {
    return `hk${cleanCode.padStart(5, '0')}`;
  }

  // A-share codes (6 digits)
  if (cleanCode.startsWith('6')) {
    return `sh${cleanCode}`;
  }
  if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
    return `sz${cleanCode}`;
  }
  if (cleanCode.startsWith('4') || cleanCode.startsWith('8') || cleanCode.startsWith('9')) {
    return `bj${cleanCode}`;
  }

  return `sh${cleanCode}`; // fallback
};

function ChartRenderer({ option }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    // Initialize chart only once
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
      const handleResize = () => chartInstance.current?.resize();
      window.addEventListener('resize', handleResize);
    }
    
    // Set option
    if (option) {
      chartInstance.current.setOption(option, true);
    }
  }, [option]);

  useEffect(() => {
    return () => {
      // Dispose only on unmount
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);
  
  return <div ref={chartRef} className="w-full h-full" />;
}

function DashboardMetric({ label, value, valNode, colSpan = 1 }) {
  return (
    <div className={`bg-gradient-to-br from-white to-slate-50/50 rounded-xl p-3 flex flex-col justify-center border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-md col-span-${colSpan}`}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 font-mono font-extrabold text-slate-700 text-[15px] truncate">
        {valNode || value || '--'}
      </div>
    </div>
  );
}

export default function FundDetailPanel({
  isOpen,
  onClose,
  detailModel,
  isLoading,
}) {
  const [chartTab, setChartTab] = useState('performance'); // performance, myprofit, theme
  const [perfPeriod, setPerfPeriod] = useState('1Y'); // 1M, 3M, 6M, 1Y, 3Y
  const [stockQuotes, setStockQuotes] = useState({});

  useEffect(() => {
    if (!isOpen || !detailModel?.holdings || detailModel.holdings.length === 0) {
      setStockQuotes({});
      return undefined;
    }

    const symbols = detailModel.holdings
      .map((h) => getTencentSymbol(h.code))
      .filter(Boolean);

    if (symbols.length === 0) {
      setStockQuotes({});
      return undefined;
    }

    let active = true;

    const fetchQuotes = async () => {
      try {
        const res = await fetch(`/api/stock-quotes?symbols=${symbols.join(',')}`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.success && data.quotes) {
            setStockQuotes(data.quotes);
          }
        }
      } catch (err) {
        console.warn('获取重仓股行情失败:', err);
      }
    };

    fetchQuotes();

    const intervalId = setInterval(() => {
      fetchQuotes();
    }, 20000); // 20s high-frequency updates

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isOpen, detailModel?.holdings]);

  const estimatedHoldingsRate = useMemo(() => {
    if (!detailModel?.holdings || detailModel.holdings.length === 0 || Object.keys(stockQuotes).length === 0) {
      return null;
    }

    let weightedSum = 0;
    let weightSum = 0;

    for (const h of detailModel.holdings) {
      const sym = getTencentSymbol(h.code);
      const quote = stockQuotes[sym];
      if (quote && typeof quote.changePercent === 'number') {
        weightedSum += quote.changePercent * (h.percent || 0);
        weightSum += (h.percent || 0);
      }
    }

    if (weightSum <= 0) return null;
    return weightedSum / weightSum;
  }, [detailModel?.holdings, stockQuotes]);

  const filteredHistory = useMemo(() => {
    if (!detailModel?.officialHistory) return [];
    const allAsc = [...detailModel.officialHistory].reverse();
    const now = new Date();
    let days = 365;
    if (perfPeriod === '1M') days = 30;
    else if (perfPeriod === '3M') days = 90;
    else if (perfPeriod === '6M') days = 180;
    else if (perfPeriod === '1Y') days = 365;
    else if (perfPeriod === '3Y') days = 1095;
    
    const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const targetKey = targetDate.toISOString().split('T')[0];
    
    return allAsc.filter(p => p.date >= targetKey);
  }, [detailModel, perfPeriod]);

  const perfOption = useMemo(() => {
    if (chartTab !== 'performance' || filteredHistory.length === 0) return null;
    const dates = filteredHistory.map(d => d.date);
    const values = filteredHistory.map(d => d.netValue);
    const baseValue = values[0];
    const rates = values.map(v => ((v - baseValue) / baseValue * 100).toFixed(2));

    return {
      title: { text: `共 ${detailModel?.officialHistory?.length || 0} 天记录，当前显示 ${filteredHistory.length} 天`, textStyle: { fontSize: 10, color: '#94a3b8', fontWeight: 'normal' }, right: 15, top: 0 },
      tooltip: { trigger: 'axis', valueFormatter: val => val + '%' },
      grid: { left: 45, right: 15, top: 25, bottom: 25 },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, color: '#64748b' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
      series: [{
        data: rates,
        type: 'line',
        smooth: false,
        showSymbol: false,
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59,130,246,0.35)' },
            { offset: 1, color: 'rgba(59,130,246,0.01)' }
          ])
        }
      }]
    };
  }, [filteredHistory, chartTab, detailModel]);

  const myProfitOption = useMemo(() => {
    if (chartTab !== 'myprofit' || !detailModel?.officialHistory) return null;
    const shares = detailModel.shares || 0;
    const totalCost = detailModel.totalCostAmount || 0;
    const startDate = detailModel.holdingStartDate;
    
    const allAsc = [...detailModel.officialHistory].reverse();
    const validData = startDate ? allAsc.filter(p => p.date >= startDate) : allAsc.slice(-100);
    
    if (validData.length === 0 || shares === 0 || totalCost === 0) {
      return { title: { text: '暂无持仓历史推算数据', textStyle: { fontSize: 12, color: '#94a3b8' }, left: 'center', top: 'center' }};
    }
    
    const dates = validData.map(d => d.date);
    const profits = validData.map(d => ((d.netValue * shares) - totalCost).toFixed(2));

    return {
      tooltip: { trigger: 'axis', valueFormatter: val => '¥' + val },
      grid: { left: 55, right: 15, top: 20, bottom: 25 },
      xAxis: { type: 'category', data: dates, boundaryGap: false, axisLabel: { fontSize: 10, color: '#64748b' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748b' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
      series: [{
        data: profits,
        type: 'line',
        smooth: false,
        showSymbol: false,
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.35)' },
            { offset: 1, color: 'rgba(16,185,129,0.01)' }
          ])
        }
      }]
    };
  }, [detailModel, chartTab]);

  const themeOption = useMemo(() => {
    if (chartTab !== 'theme' || !detailModel?.grandTotal || detailModel.grandTotal.length === 0) {
      return { title: { text: '暂无业绩对比数据', textStyle: { fontSize: 12, color: '#94a3b8' }, left: 'center', top: 'center' }};
    }

    const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#14b8a6'];
    const seriesList = detailModel.grandTotal.map((item, idx) => {
      const dataPoints = item.data.map(p => {
        const d = new Date(p[0]);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return [dateStr, p[1]];
      });

      return {
        name: item.name,
        type: 'line',
        data: dataPoints,
        smooth: false,
        showSymbol: false,
        itemStyle: { color: colors[idx % colors.length] }
      };
    });

    return {
      legend: {
        data: detailModel.grandTotal.map(item => item.name),
        textStyle: { fontSize: 10, color: '#64748b' },
        top: 0,
        right: 15
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: val => val + '%'
      },
      grid: { left: 45, right: 15, top: 35, bottom: 25 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLabel: { fontSize: 10, color: '#64748b' },
        axisLine: { lineStyle: { color: '#e2e8f0' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b', formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
      },
      series: seriesList
    };
  }, [detailModel, chartTab]);

  const industryData = useMemo(() => {
    if (Array.isArray(detailModel?.industries) && detailModel.industries.length > 0) {
      return detailModel.industries;
    }
    return [];
  }, [detailModel]);

  if (!isOpen || !detailModel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-8 overflow-hidden transition-opacity duration-300 ease-out" data-testid="fund-detail-overlay" onClick={onClose}>
      <div 
        className="w-full max-w-[1400px] h-[88vh] md:h-full max-h-[90vh] md:max-h-[90vh] flex flex-col rounded-t-3xl md:rounded-[24px] bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out md:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS style Bottom Sheet Drag Handle */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 md:hidden shrink-0" />
        
        {/* Header */}
        <div className="shrink-0 h-14 md:h-16 border-b border-slate-200/80 bg-slate-50/80 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 md:px-2.5 md:py-1 text-[10px] md:text-xs font-bold tracking-wide shrink-0">{detailModel.code}</span>
            <h2 className="text-base md:text-xl font-black text-slate-800 tracking-tight truncate max-w-[280px] sm:max-w-[480px] md:max-w-[700px] lg:max-w-[900px] xl:max-w-none" title={detailModel.name}>{detailModel.name}</h2>
            {isLoading && <span className="text-[10px] text-slate-400 animate-pulse shrink-0">刷新中...</span>}
          </div>
          <button onClick={onClose} className="rounded-full hover:bg-slate-200 p-2 text-slate-400 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden bg-white p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* 左侧：核心指标区 (3/12) */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-4 h-auto md:h-full shrink-0 md:overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-sm font-black tracking-widest text-slate-800 uppercase">核心指标</h3>
              <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-full">{detailModel.valuationSource}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 content-start shrink-0 md:flex-1 md:overflow-y-auto custom-scrollbar">
              <DashboardMetric label="估算涨幅 (大盘)" valNode={<FormatNumber value={detailModel.dailyRate} isPercent={true} />} />
              <DashboardMetric label="实时持仓估算" valNode={<FormatNumber value={estimatedHoldingsRate} isPercent={true} />} />
              <DashboardMetric label="近1年涨幅" valNode={<FormatNumber value={detailModel.performance.oneYear} isPercent={true} />} colSpan={2} />
              
              <DashboardMetric label="持有金额" value={formatCurrencyAmount(detailModel.holdingAmount)} colSpan={2} />
              
              <DashboardMetric label="持有份额" value={formatPlainNumber(detailModel.shares, ' 份')} />
              <DashboardMetric label="持仓占比" valNode={<FormatNumber value={detailModel.holdingRatio} isPercent={true} />} />
              
              <DashboardMetric label="持有收益" valNode={<FormatNumber value={detailModel.holdingProfit} isCurrency={true} />} />
              <DashboardMetric label="持有收益率" valNode={<FormatNumber value={detailModel.holdingProfitRate} isPercent={true} />} />
              
              <DashboardMetric label="持仓成本" value={formatPlainNumber(detailModel.unitCost)} />
              <DashboardMetric label="持有天数" value={formatDayCount(detailModel.holdingDays)} />
              
              <DashboardMetric label="当日收益" valNode={<FormatNumber value={detailModel.dailyProfit} isCurrency={true} />} />
              <DashboardMetric label="昨日收益" valNode={<FormatNumber value={detailModel.yesterdayProfit} isCurrency={true} />} />
              
              <DashboardMetric label="关联板块" value={detailModel.relatedThemes.length > 0 ? detailModel.relatedThemes.join(' / ') : '--'} colSpan={2} />
            </div>
          </div>

          {/* 中侧：图表区 (6/12) */}
          <div className="col-span-1 md:col-span-6 flex flex-col gap-4 h-[340px] md:h-full shrink-0 border-y md:border-y-0 md:border-x border-slate-100 py-4 md:py-0 md:px-6 md:overflow-hidden">
            <div className="flex items-center gap-4 shrink-0 border-b border-slate-200 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none">
              {['performance', 'myprofit', 'theme'].map((tab) => {
                const labels = { performance: '业绩走势图', myprofit: '我的收益涨势图', theme: '业绩对比图' };
                return (
                  <button
                    key={tab}
                    onClick={() => setChartTab(tab)}
                    className={`pb-2 text-xs md:text-sm font-bold transition-all relative shrink-0 ${chartTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {labels[tab]}
                    {chartTab === tab && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full"></span>}
                  </button>
                );
              })}
            </div>

            {chartTab === 'performance' && (
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto whitespace-nowrap py-0.5 scrollbar-none">
                {['1M', '3M', '6M', '1Y', '3Y'].map((period) => {
                  const pLabels = { '1M': '近1月', '3M': '近3月', '6M': '近6月', '1Y': '近1年', '3Y': '近3年' };
                  return (
                    <button
                      key={period}
                      onClick={() => setPerfPeriod(period)}
                      className={`px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold rounded-full transition-colors shrink-0 ${perfPeriod === period ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {pLabels[period]}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 h-[200px] md:h-auto bg-white rounded-2xl border border-slate-100/50 shadow-inner overflow-hidden">
              {chartTab === 'performance' && <ChartRenderer option={perfOption} />}
              {chartTab === 'myprofit' && <ChartRenderer option={myProfitOption} />}
              {chartTab === 'theme' && <ChartRenderer option={themeOption} />}
            </div>
          </div>

          {/* 右侧：结构区 (3/12) */}
          <div className="col-span-1 md:col-span-3 flex flex-col gap-6 h-auto md:h-full shrink-0 md:overflow-hidden">
            
            {/* 持仓情况 */}
            <div className="h-[260px] md:h-1/2 flex flex-col gap-3 shrink-0 md:overflow-hidden">
              <h3 className="text-sm font-black tracking-widest text-slate-800 uppercase shrink-0">持仓情况</h3>
              <div className="flex-1 overflow-hidden flex flex-col border border-slate-200/60 rounded-xl bg-white">
                <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200/60 p-2 text-[10px] font-bold text-slate-400 tracking-wider">
                  <div className="pl-1">股票名称</div>
                  <div className="text-right">占比</div>
                  <div className="text-right pr-1">估算涨幅</div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                  {detailModel.holdings && detailModel.holdings.length > 0 ? (
                    detailModel.holdings.slice(0, 10).map((h, i) => {
                      const cleanCode = h.code.replace('1.', '').replace('0.', '').replace('100.', '');
                      return (
                        <div key={i} className="grid grid-cols-3 p-1.5 text-[11px] hover:bg-slate-50 rounded-md transition-colors items-center">
                          <div className="font-bold text-slate-700 truncate" title={h.name}>
                            {h.name}
                            <div className="text-[9px] text-slate-400 font-normal leading-none mt-0.5">{cleanCode}</div>
                          </div>
                          <div className="text-right font-mono font-medium text-slate-500">{formatPlainNumber(h.percent, '%')}</div>
                          <div className="text-right font-mono font-bold">
                            {(() => {
                              const sym = getTencentSymbol(h.code);
                              const q = stockQuotes[sym];
                              if (q && typeof q.changePercent === 'number') {
                                return (
                                  <span className={q.changePercent > 0 ? 'text-rose-500' : q.changePercent < 0 ? 'text-emerald-500' : 'text-slate-400'}>
                                    {q.changePercent > 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                                  </span>
                                );
                              }
                              return <span className="text-slate-300">--</span>;
                            })()}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 py-8">暂无持仓公开数据</div>
                  )}
                </div>
              </div>
            </div>

            {/* 行业分布 */}
            <div className="h-[220px] md:h-1/2 flex flex-col gap-3 shrink-0 md:overflow-hidden pb-4 md:pb-0">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black tracking-widest text-slate-800 uppercase">行业分布</h3>
                <span className="text-[9px] text-blue-600 font-bold border border-blue-200 bg-blue-50 px-1.5 rounded uppercase">官方数据</span>
              </div>
              <div className="flex-1 border border-slate-200/60 rounded-xl overflow-y-auto custom-scrollbar md:overflow-hidden bg-slate-50/30 flex flex-col justify-center px-4 py-3 gap-3">
                {industryData.length > 0 ? (
                  industryData.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-[11px] font-bold text-slate-700 truncate" title={item.name}>{item.name}</div>
                      <div className="flex-1 h-3 bg-blue-100/50 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-sm" style={{ width: `${item.value}%` }}></div>
                      </div>
                      <div className="w-12 shrink-0 text-right text-[11px] font-mono font-bold text-slate-600">{item.value.toFixed(2)}%</div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 py-8">暂无行业公开配置数据</div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
