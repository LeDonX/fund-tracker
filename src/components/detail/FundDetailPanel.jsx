import React, { useState, useEffect, useMemo } from 'react';
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

// 翻译成分股代码为腾讯 API 格式
const translateStockCode = (rawCode) => {
  const code = String(rawCode).trim();
  if (code.startsWith('1.')) {
    return `s_sh${code.slice(2)}`;
  } else if (code.startsWith('0.')) {
    return `s_sz${code.slice(2)}`;
  } else if (code.startsWith('100.')) {
    // 港股
    return `s_hk${code.slice(4)}`;
  }

  // A股代码常规猜测
  if (/^\d{6}$/.test(code)) {
    if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) {
      return `s_sh${code}`;
    } else {
      return `s_sz${code}`;
    }
  } else if (/^\d{5}$/.test(code)) {
    return `s_hk${code}`;
  }

  return `s_${code}`;
};

function DetailMetricCard({ label, value, testId, hint, accent = 'slate', children }) {
  const accentClass = accent === 'blue'
    ? 'border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 shadow-[0_4px_20px_rgba(59,130,246,0.03)]'
    : accent === 'emerald'
      ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 shadow-[0_4px_20px_rgba(16,185,129,0.03)]'
      : 'border-slate-200/80 bg-gradient-to-br from-white/95 to-slate-50/60 shadow-[0_4px_20px_rgba(0,0,0,0.01)]';

  return (
    <div className={`rounded-3xl border p-5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${accentClass}`} data-testid={testId}>
      <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-extrabold text-slate-800 font-mono tracking-tight">{children ?? value}</div>
      {hint && <p className="mt-2 text-[11px] leading-relaxed text-slate-400/90">{hint}</p>}
    </div>
  );
}

function DetailStatRow({ label, value, testId, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200/75 bg-white/95 px-5 py-4 shadow-sm transition-all hover:bg-slate-50/50 hover:shadow-md hover:border-slate-300" data-testid={testId}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-slate-700">{label}</div>
          {hint && <p className="mt-1 text-xs text-slate-400 leading-relaxed">{hint}</p>}
        </div>
        <div className="text-right text-[15px] font-bold text-slate-800 font-mono">{value}</div>
      </div>
    </div>
  );
}

export default function FundDetailPanel({
  isOpen,
  onClose,
  onRefresh,
  detailModel,
  isLoading,
  hasStaleCache,
  errorMessage,
}) {
  const [stockQuotes, setStockQuotes] = useState({});
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  // 成分股高频实盘行情轮询
  useEffect(() => {
    if (!isOpen || !detailModel?.holdings || detailModel.holdings.length === 0) {
      setStockQuotes({});
      setStockError('');
      return;
    }

    let active = true;
    let timerId = null;

    const fetchStockPrices = async () => {
      const holdings = detailModel.holdings;
      const queryList = holdings.map(h => translateStockCode(h.code)).filter(Boolean);

      if (queryList.length === 0) return;

      try {
        if (Object.keys(stockQuotes).length === 0) {
          setIsStockLoading(true);
        }

        const scriptId = `batch_stocks_${Date.now()}`;
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://qt.gtimg.cn/q=${queryList.join(',')}&rt=${Date.now()}`;
        script.async = true;

        const p = new Promise((resolve, reject) => {
          script.onload = () => {
            if (!active) {
              script.remove();
              resolve(null);
              return;
            }

            try {
              const quotes = {};
              queryList.forEach((qKey) => {
                const varName = `v_${qKey}`;
                const rawData = window[varName];
                if (rawData) {
                  const parts = rawData.split('~');
                  const stockPrice = parseFloat(parts[3]) || 0;
                  const stockChangePercent = parseFloat(parts[5]) || 0;

                  // 匹配原基金重仓股 code
                  const matchCode = holdings.find(h => {
                    return translateStockCode(h.code) === qKey;
                  })?.code;

                  if (matchCode) {
                    quotes[matchCode] = {
                      price: stockPrice,
                      changePercent: stockChangePercent,
                    };
                  }
                }
              });

              script.remove();
              resolve(quotes);
            } catch (err) {
              script.remove();
              reject(err);
            }
          };

          script.onerror = () => {
            script.remove();
            reject(new Error('腾讯成分股行情加载失败'));
          };
        });

        document.body.appendChild(script);
        const quotesResult = await p;

        if (active && quotesResult) {
          setStockQuotes(quotesResult);
          setStockError('');
        }
      } catch (err) {
        console.warn('成分股行情获取失败:', err);
        if (active) {
          setStockError('成分股实盘接口请求超时，当前显示为持仓静态结构。');
        }
      } finally {
        if (active) {
          setIsStockLoading(false);
        }
      }
    };

    // 立即执行
    void fetchStockPrices();

    // 交易时间内每 5 秒轮询更新 (09:20-11:35, 12:55-15:05)
    timerId = window.setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const mins = now.getMinutes();
      const timeVal = hours * 100 + mins;
      const isTradingTime = (timeVal >= 920 && timeVal <= 1135) || (timeVal >= 1255 && timeVal <= 1505);
      if (isTradingTime) {
        void fetchStockPrices();
      }
    }, 5000);

    return () => {
      active = false;
      if (timerId) window.clearInterval(timerId);
    };
  }, [isOpen, detailModel?.holdings]);

  // 重仓成分股归一化实盘仿真计算
  const holdingsSimulation = useMemo(() => {
    if (!detailModel?.holdings || detailModel.holdings.length === 0) return null;

    let totalWeight = 0;
    let weightedChange = 0;
    let validCount = 0;

    detailModel.holdings.forEach((h) => {
      const quote = stockQuotes[h.code];
      if (quote && Number.isFinite(quote.changePercent)) {
        totalWeight += h.percent;
        weightedChange += h.percent * quote.changePercent;
        validCount++;
      }
    });

    if (totalWeight === 0) return null;

    const simulatedRate = weightedChange / totalWeight;

    return {
      simulatedRate,
      totalWeight,
      validCount,
    };
  }, [detailModel?.holdings, stockQuotes]);

  if (!isOpen || !detailModel) return null;

  const valuationSourceLabel = detailModel.valuationSource === 'official'
    ? '当前列表使用官方净值口径'
    : detailModel.valuationSource === 'estimate'
      ? '当前列表使用盘中估值口径'
      : detailModel.valuationSource === 'quote'
        ? '当前列表使用最新净值口径'
        : '当前列表使用本地快照口径';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4" data-testid="fund-detail-overlay">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[32px] border border-slate-200/80 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-250 flex flex-col">
        
        {/* --- 顶部 Header --- */}
        <div className="sticky top-0 z-10 border-b border-slate-250/70 bg-white/95 backdrop-blur-md px-6 py-5 md:px-10 md:py-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-slate-600">{detailModel.code}</span>
              <span className="rounded-full border border-blue-200 bg-blue-50/70 px-2.5 py-0.5 text-blue-700">{valuationSourceLabel}</span>
              {detailModel.cacheFetchedAt > 0 && (
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-slate-500">
                  详情缓存已更新
                </span>
              )}
            </div>
            <h2 className="mt-3.5 text-2xl font-black tracking-tight text-slate-900 md:text-3xl" data-testid="detail-fund-name">{detailModel.name}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              详情页将当前列表口径与官方净值历史拆开展示：持有金额与当日收益沿用列表展示口径，昨日收益与阶段涨幅在有官方净值历史时展示。
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-start">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              data-testid="refresh-fund-detail"
            >
              {isLoading ? '刷新中...' : '刷新详情'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-350 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
              data-testid="close-fund-detail"
            >
              返回列表
            </button>
          </div>
        </div>

        {/* --- 异步提示 --- */}
        {(isLoading || errorMessage || hasStaleCache) && (
          <div className="mx-6 mt-4 md:mx-10 rounded-2xl border border-blue-100 bg-blue-50/50 px-4.5 py-3.5 text-xs text-blue-800/90 font-medium" data-testid="detail-fetch-status">
            {isLoading && <p className="animate-pulse">正在刷新详情缓存，列表口径不会被这次详情请求阻塞。</p>}
            {!isLoading && hasStaleCache && <p>远端详情暂时不可用，当前显示的是最近一次成功缓存的数据。</p>}
            {!isLoading && errorMessage && !hasStaleCache && <p className="text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">{errorMessage}</p>}
          </div>
        )}

        {/* --- 内容核心区 --- */}
        <div className="flex-1 px-6 py-6 md:px-10 md:py-8 space-y-6">
          
          {/* 四个主核心指标 */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailMetricCard
              label="持有金额"
              testId="detail-field-holding-amount"
              value={formatCurrencyAmount(detailModel.holdingAmount)}
              hint="当前列表展示口径下的持仓金额。"
              accent="blue"
            />
            <DetailMetricCard
              label="当日收益"
              testId="detail-field-daily-profit"
              hint="沿用当前列表的展示口径；若列表正在用估值，这里也显示估值口径。"
              accent="blue"
            >
              <FormatNumber value={detailModel.dailyProfit} isCurrency={true} />
            </DetailMetricCard>
            <DetailMetricCard
              label="最新净值"
              testId="detail-field-latest-net-value"
              value={formatPlainNumber(detailModel.latestNetValue)}
              hint={detailModel.officialLatestDate ? `优先官方净值，最新日期 ${detailModel.officialLatestDate}` : '官方净值缺失时回退最新可用净值。'}
              accent="emerald"
            />
            <DetailMetricCard
              label="估算净值"
              testId="detail-field-estimated-net-value"
              value={formatPlainNumber(detailModel.estimatedNetValue)}
              hint={detailModel.quoteUpdateTime ? `盘中估值更新时间 ${detailModel.quoteUpdateTime}` : '盘中估值不可用时显示 --。'}
              accent="emerald"
            >
              {formatPlainNumber(detailModel.estimatedNetValue)}
            </DetailMetricCard>
          </section>

          {/* 左右双栏布局 */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            
            {/* 左侧大栏：持仓详情与重仓仿真 */}
            <section className="space-y-6">
              
              {/* 持仓明细 */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">持仓明细</h3>
                <p className="mt-1 text-xs text-slate-400/90">这里的字段根据源持仓、列表展示值、组合总额和详情缓存动态派生。</p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <DetailStatRow label="持有份额" testId="detail-field-shares" value={formatPlainNumber(detailModel.shares, ' 份')} />
                <DetailStatRow label="持仓占比" testId="detail-field-holding-ratio" value={<FormatNumber value={detailModel.holdingRatio} isPercent={true} />} hint="持有金额 / 当前组合持有总金额" />
                <DetailStatRow label="持有收益" testId="detail-field-holding-profit" value={<FormatNumber value={detailModel.holdingProfit} isCurrency={true} />} hint="持有金额 - 总持仓成本" />
                <DetailStatRow label="持有收益率" testId="detail-field-holding-profit-rate" value={<FormatNumber value={detailModel.holdingProfitRate} isPercent={true} />} hint="持有收益 / 总持仓成本" />
                <DetailStatRow label="持仓成本" testId="detail-field-unit-cost" value={formatPlainNumber(detailModel.unitCost)} hint={Number.isFinite(detailModel.totalCostAmount) ? `单位持仓成本；总成本约 ${formatCurrencyAmount(detailModel.totalCostAmount)}` : '缺少可用总成本时显示 --。'} />
                <DetailStatRow label="持有天数" testId="detail-field-holding-days" value={formatDayCount(detailModel.holdingDays)} hint={detailModel.holdingStartDate ? `起始日 ${detailModel.holdingStartDate}` : '旧持仓没有起始日期。'} />
              </div>

              {/* 成分股秒级实时仿真卡片 (方案三) */}
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>重仓持仓秒级实时仿真</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      基于披露的前十大重仓股实时行情合成（交易时段每5秒刷新）
                    </p>
                  </div>
                </div>

                {detailModel.holdings && detailModel.holdings.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {/* 综合仿真卡片 */}
                    {holdingsSimulation ? (
                      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white shadow-sm flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                            前十重仓仿真涨幅 (归一化到 100%)
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold font-mono tracking-tight">
                              <FormatNumber value={holdingsSimulation.simulatedRate} isPercent={true} />
                            </span>
                            <span className="text-xs text-slate-400">
                              (已匹配 {holdingsSimulation.validCount}/10 股，总占比 {formatPlainNumber(holdingsSimulation.totalWeight, '%')})
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-300 border border-white/5 backdrop-blur-sm">
                            秒级实盘合成
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4.5 text-center text-xs text-slate-400 animate-pulse">
                        {isStockLoading ? '正在拉取成分股最新实盘报价...' : '等待加载实盘行情...'}
                      </div>
                    )}

                    {stockError && (
                      <p className="text-[11px] font-medium text-amber-600 bg-amber-50 px-3.5 py-2.5 rounded-xl border border-amber-100">
                        ⚠️ {stockError}
                      </p>
                    )}

                    {/* 成分股列表 */}
                    <div className="overflow-hidden border border-slate-200/60 rounded-2xl bg-slate-55/35">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-150 bg-slate-50/70 text-[10.5px] font-bold text-slate-400 tracking-wider">
                            <th className="px-4 py-3">股票名称</th>
                            <th className="px-4 py-3">持仓权重</th>
                            <th className="px-4 py-3 text-right">实盘现价</th>
                            <th className="px-4 py-3 text-right">今日涨幅</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detailModel.holdings.map((h, i) => {
                            const quote = stockQuotes[h.code];
                            const cleanCode = h.code.replace('1.', '').replace('0.', '').replace('100.', '');
                            return (
                              <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                                <td className="px-4 py-3.5 font-bold text-slate-700">
                                  <div>{h.name}</div>
                                  <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{cleanCode}</div>
                                </td>
                                <td className="px-4 py-3.5 text-slate-600">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono font-bold w-10 shrink-0">{formatPlainNumber(h.percent, '%')}</span>
                                    <div className="hidden sm:block w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, (h.percent / 15) * 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-600">
                                  {quote ? formatPlainNumber(quote.price) : '--'}
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono">
                                  {quote ? <FormatNumber value={quote.changePercent} isPercent={true} /> : '--'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-150 bg-slate-50/45 p-6 text-center text-xs text-slate-400">
                    暂无当前基金的成分股公开披露持仓（多见于新设立基金、债券型或QDII基金）。
                  </div>
                )}
              </div>

              {/* 昨日收益与主题 */}
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">净值与行情口径</h3>
                  <p className="mt-1 text-xs text-slate-400/90">当日收益与最新净值拆开计算，以保障官方数据的可追溯性。</p>
                </div>
                <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                  <DetailStatRow label="昨日收益" testId="detail-field-yesterday-profit" value={<FormatNumber value={detailModel.yesterdayProfit} isCurrency={true} />} hint={detailModel.officialLatestDate && detailModel.officialPreviousDate ? `按 ${detailModel.officialLatestDate} 与 ${detailModel.officialPreviousDate} 官方收盘净值计算` : '缺少连续官方净值点时显示 --。'} />
                  <DetailStatRow label="关联板块" testId="detail-field-related-themes" value={detailModel.relatedThemes.length > 0 ? detailModel.relatedThemes.join(' / ') : '--'} hint={detailModel.isRelatedThemesFallback ? '远端主题标签暂不可用，当前回退到本地分组。' : '优先显示远端主题 / 板块标签。'} />
                </div>
              </div>
            </section>

            {/* 右侧小栏：阶段表现与说明书 */}
            <section className="space-y-6">
              
              {/* 阶段表现 */}
              <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">阶段表现</h3>
                <p className="mt-1 text-xs text-slate-400/90">基于官方披露的历史收盘净值分析，不包含估算值。</p>
                <div className="mt-4 space-y-3">
                  <DetailStatRow label="今年涨幅" testId="detail-field-performance-ytd" value={<FormatNumber value={detailModel.performance.ytd} isPercent={true} />} />
                  <DetailStatRow label="近1年" testId="detail-field-performance-1y" value={<FormatNumber value={detailModel.performance.oneYear} isPercent={true} />} />
                  <DetailStatRow label="近3年" testId="detail-field-performance-3y" value={<FormatNumber value={detailModel.performance.threeYear} isPercent={true} />} />
                </div>
              </div>

              {/* 说明书 */}
              <div className="rounded-[24px] border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-slate-100 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -z-0 pointer-events-none"></div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-300 relative z-10">指标说明书</h3>
                <div className="mt-4 space-y-3.5 text-[11px] leading-relaxed text-slate-300/90 relative z-10">
                  <p>• <strong className="text-white">持有金额 / 当日收益</strong>：继承列表所选数据源计算，保证您在主面板与详情页看到完全一致的动态财务数据。</p>
                  <p>• <strong className="text-white">昨日收益 / 阶段表现</strong>：严格从官方发布历史净值（东财官方）拉取，不作任何盘中预估推测。</p>
                  <p>• <strong className="text-white">估算净值 / 净值补位</strong>：由天天基金/新浪/腾讯行情接口实时多域名驱动。</p>
                  <p>• <strong className="text-white">实时仿真（秒级）</strong>：由底层十只重仓股票在交易时间内进行高频每5秒实盘加权合成，适合在估算停滞时做高精度辅助印证。</p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
