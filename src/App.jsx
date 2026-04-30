import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Upload, 
  ArrowRightLeft, 
  TrendingUp, 
  Wallet,
  Settings,
  History,
  ChevronDown,
  ChevronRight,
  GripVertical,
  FolderPlus,
  X,
  AlertCircle,
  Trash2,
  Clock
} from 'lucide-react';
import Sortable from 'sortablejs';
import {
  buildDetailCacheEntry,
  buildFundDetailModel,
  buildStoredDetailCachePayload,
  DETAIL_CACHE_STORAGE_KEY,
  isDetailCacheStale,
  normalizeStoredDetailCacheStore,
} from './fundDetails';

// --- 初始分组数据 ---
const INITIAL_SECTORS = ['大消费', '科技半导体', '医疗医药', '均衡宽基'];

// --- 模拟交易记录数据生成器 (历史记录弹窗用) ---
const generateMockHistory = () => {
  return [
    { id: 101, date: '2026-03-15', type: '买入', amount: 10000, status: '确认成功' },
    { id: 102, date: '2026-02-20', type: '买入', amount: 20000, status: '确认成功' },
    { id: 103, date: '2025-12-10', type: '分红', amount: 500, status: '已发放' },
    { id: 104, date: '2025-08-05', type: '买入', amount: 30000, status: '确认成功' },
  ];
};

// --- 辅助组件：涨跌颜色格式化 ---
const FormatNumber = ({ value, isPercent = false, isCurrency = false, showSign = true }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="text-slate-400">--</span>;
  }

  if (value === 0) {
    const zeroValue = isCurrency
      ? Number(0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00';

    return <span className="text-slate-500">{zeroValue}{isPercent ? '%' : ''}</span>;
  }
  
  const colorClass = value > 0 ? 'text-red-500' : 'text-green-500';
  const sign = value > 0 && showSign ? '+' : '';
  
  let formattedValue = Math.abs(value).toFixed(2);
  if (isCurrency) {
    formattedValue = Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <span className={`font-medium ${colorClass}`}>
      {sign}{value < 0 ? '-' : ''}{formattedValue}{isPercent ? '%' : ''}
    </span>
  );
};

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

// --- 辅助组件：弹窗 Modal ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const DetailMetricCard = ({ label, value, testId, hint, accent = 'slate', children }) => {
  const accentClass = accent === 'blue'
    ? 'border-blue-200 bg-blue-50/80'
    : accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/80'
      : 'border-slate-200 bg-white/90';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accentClass}`} data-testid={testId}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{children ?? value}</div>
      {hint && <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
};

const DetailStatRow = ({ label, value, testId, hint }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm" data-testid={testId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700">{label}</div>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
        </div>
        <div className="text-right text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
};

const FundDetailPanel = ({
  isOpen,
  onClose,
  onRefresh,
  detailModel,
  isLoading,
  hasStaleCache,
  errorMessage,
}) => {
  if (!isOpen || !detailModel) return null;

  const valuationSourceLabel = detailModel.valuationSource === 'official'
    ? '当前列表使用官方净值口径'
    : detailModel.valuationSource === 'estimate'
      ? '当前列表使用盘中估值口径'
      : detailModel.valuationSource === 'quote'
        ? '当前列表使用最新净值口径'
        : '当前列表使用本地快照口径';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" data-testid="fund-detail-overlay">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-200 bg-white/95 px-5 py-4 md:px-8 md:py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{detailModel.code}</span>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{valuationSourceLabel}</span>
                    {detailModel.cacheFetchedAt > 0 && (
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-500">
                        详情缓存已更新
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl" data-testid="detail-fund-name">{detailModel.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    详情页将当前列表口径与官方净值历史拆开展示：持有金额 / 当日收益沿用列表展示口径，昨日收益与阶段涨幅只在有官方净值历史时展示。
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading}
                    data-testid="refresh-fund-detail"
                  >
                    {isLoading ? '刷新中...' : '刷新详情'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                    data-testid="close-fund-detail"
                  >
                    返回列表
                  </button>
                </div>
              </div>

              {(isLoading || errorMessage || hasStaleCache) && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600" data-testid="detail-fetch-status">
                  {isLoading && <p>正在刷新详情缓存，列表口径不会被这次详情请求阻塞。</p>}
                  {!isLoading && hasStaleCache && <p>远端详情暂时不可用，当前显示的是最近一次成功缓存的数据。</p>}
                  {!isLoading && errorMessage && !hasStaleCache && <p>{errorMessage}</p>}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-7">
              <section className="grid gap-4 lg:grid-cols-4">
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
                />
              </section>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">持仓语义</h3>
                    <p className="mt-2 text-sm text-slate-500">这里的字段只根据源持仓、列表展示值、组合总额和详情缓存派生，不会把详情页推导值反写回持仓列表。</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailStatRow label="持有份额" testId="detail-field-shares" value={formatPlainNumber(detailModel.shares, ' 份')} />
                    <DetailStatRow label="持仓占比" testId="detail-field-holding-ratio" value={<FormatNumber value={detailModel.holdingRatio} isPercent={true} />} hint="持有金额 / 当前组合持有金额" />
                    <DetailStatRow label="持有收益" testId="detail-field-holding-profit" value={<FormatNumber value={detailModel.holdingProfit} isCurrency={true} />} hint="持有金额 - 总持仓成本" />
                    <DetailStatRow label="持有收益率" testId="detail-field-holding-profit-rate" value={<FormatNumber value={detailModel.holdingProfitRate} isPercent={true} />} hint="持有收益 / 总持仓成本" />
                    <DetailStatRow label="持仓成本" testId="detail-field-unit-cost" value={formatPlainNumber(detailModel.unitCost)} hint={Number.isFinite(detailModel.totalCostAmount) ? `单位持仓成本；总成本约 ${formatCurrencyAmount(detailModel.totalCostAmount)}` : '缺少可用总成本时显示 --。'} />
                    <DetailStatRow label="持有天数" testId="detail-field-holding-days" value={formatDayCount(detailModel.holdingDays)} hint={detailModel.holdingStartDate ? `起始日 ${detailModel.holdingStartDate}` : '旧持仓没有起始日期，不回填历史。'} />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">净值与行情口径</h3>
                        <p className="mt-2 text-sm text-slate-500">当日收益与最新净值故意拆开，避免把估值和官方净值混成一个字段。</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <DetailStatRow label="昨日收益" testId="detail-field-yesterday-profit" value={<FormatNumber value={detailModel.yesterdayProfit} isCurrency={true} />} hint={detailModel.officialLatestDate && detailModel.officialPreviousDate ? `按 ${detailModel.officialLatestDate} 与 ${detailModel.officialPreviousDate} 两个官方净值点计算` : '缺少连续两个官方净值点时显示 --。'} />
                      <DetailStatRow label="关联板块" testId="detail-field-related-themes" value={detailModel.relatedThemes.length > 0 ? detailModel.relatedThemes.join(' / ') : '--'} hint={detailModel.isRelatedThemesFallback ? '远端主题标签暂不可用，当前回退到本地分组。' : '优先显示远端主题 / 板块标签。'} />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">阶段表现</h3>
                    <p className="mt-2 text-sm text-slate-500">只根据官方净值历史推导；历史不够长时维持 --，不做补猜。</p>
                    <div className="mt-4 space-y-3">
                      <DetailStatRow label="今年涨幅" testId="detail-field-performance-ytd" value={<FormatNumber value={detailModel.performance.ytd} isPercent={true} />} />
                      <DetailStatRow label="近1年" testId="detail-field-performance-1y" value={<FormatNumber value={detailModel.performance.oneYear} isPercent={true} />} />
                      <DetailStatRow label="近3年" testId="detail-field-performance-3y" value={<FormatNumber value={detailModel.performance.threeYear} isPercent={true} />} />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-slate-100 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">数据来源</h3>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      <p>持有金额 / 当日收益：来自当前列表的展示 fund snapshot。</p>
                      <p>昨日收益 / 今年涨幅 / 近1年 / 近3年：来自东财官方净值历史缓存。</p>
                      <p>估算净值 / 最新净值补位：来自天天基金估值 JSONP 缓存。</p>
                      <p>关联板块：优先远端主题标签，拿不到时回退本地分组。</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 天天基金 / 东财估值服务：JSONP Script 注入法
// ============================================================================
const SCRIPT_TIMEOUT_MS = 8000;

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readStoredJson = (storageKey, fallbackValue) => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) return fallbackValue;

    const parsedValue = JSON.parse(rawValue);
    return parsedValue ?? fallbackValue;
  } catch (error) {
    console.warn(`本地缓存解析失败: ${storageKey}`, error);
    return fallbackValue;
  }
};

const parsePercentageText = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace('%', '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const inferStoredQuoteSource = (fund) => {
  const storedQuoteSource = typeof fund?.quoteSource === 'string' ? fund.quoteSource : '';
  if (storedQuoteSource === 'estimate' || storedQuoteSource === 'quote') {
    return storedQuoteSource;
  }

  const currentNetValue = toNumber(fund?.currentNetValue);
  const lastNetValue = toNumber(fund?.lastNetValue);
  if (currentNetValue > 0 && lastNetValue > 0 && Math.abs(currentNetValue - lastNetValue) > 0.000001) {
    return 'estimate';
  }

  if (currentNetValue > 0 || lastNetValue > 0) {
    return 'quote';
  }

  return '';
};

const getQuoteSourceFromQuote = (quote) => {
  if (quote?.quoteSource === 'estimate' || quote?.quoteSource === 'quote') {
    return quote.quoteSource;
  }

  if (toNumber(quote?.estimatedNetValue) > 0) return 'estimate';
  if (toNumber(quote?.lastNetValue) > 0) return 'quote';
  return '';
};

const normalizeStoredFund = (fund, index) => {
  if (!fund || typeof fund !== 'object') {
    return null;
  }

  const hasTrackedShares = fund.shares !== undefined || fund.costAmount !== undefined;

  return {
    id: fund.id ?? Date.now() + index,
    name: typeof fund.name === 'string' && fund.name.trim() ? fund.name.trim() : '未命名基金',
    code: String(fund.code || '').trim(),
    sector: typeof fund.sector === 'string' ? fund.sector : '',
    amount: Math.max(0, toNumber(fund.amount)),
    dailyRate: toNumber(fund.dailyRate),
    dailyProfit: toNumber(fund.dailyProfit),
    totalProfit: toNumber(fund.totalProfit),
    totalRate: toNumber(fund.totalRate),
    weeklyProfit: toNumber(fund.weeklyProfit),
    monthlyProfit: toNumber(fund.monthlyProfit),
    shares: hasTrackedShares ? Math.max(0, toNumber(fund.shares)) : undefined,
    costAmount: fund.costAmount !== undefined ? Math.max(0, toNumber(fund.costAmount)) : undefined,
    currentNetValue: fund.currentNetValue !== undefined ? Math.max(0, toNumber(fund.currentNetValue)) : undefined,
    lastNetValue: fund.lastNetValue !== undefined ? Math.max(0, toNumber(fund.lastNetValue)) : undefined,
    officialCurrentNetValue: fund.officialCurrentNetValue !== undefined ? Math.max(0, toNumber(fund.officialCurrentNetValue)) : undefined,
    officialLastNetValue: fund.officialLastNetValue !== undefined ? Math.max(0, toNumber(fund.officialLastNetValue)) : undefined,
    officialDailyRate: fund.officialDailyRate !== undefined ? toNumber(fund.officialDailyRate) : undefined,
    quoteSource: inferStoredQuoteSource(fund),
    lastValuationTime: typeof fund.lastValuationTime === 'string' ? fund.lastValuationTime : '',
    netValueDate: typeof fund.netValueDate === 'string' ? fund.netValueDate : '',
    officialNetValueDate: typeof fund.officialNetValueDate === 'string' ? fund.officialNetValueDate : '',
    officialPreviousNetValueDate: typeof fund.officialPreviousNetValueDate === 'string' ? fund.officialPreviousNetValueDate : '',
    holdingStartDate: typeof fund.holdingStartDate === 'string' ? fund.holdingStartDate : '',
    bootstrapSharesFromAmount: Boolean(fund.bootstrapSharesFromAmount),
  };
};

const normalizeStoredFunds = (storedFunds) => {
  if (!Array.isArray(storedFunds)) return [];

  return storedFunds
    .map((fund, index) => normalizeStoredFund(fund, index))
    .filter((fund) => fund?.code);
};

const normalizeStoredSectors = (storedSectors) => {
  if (!Array.isArray(storedSectors)) {
    return INITIAL_SECTORS;
  }

  const normalized = storedSectors
    .map((sector) => (typeof sector === 'string' ? sector.trim() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : INITIAL_SECTORS;
};

const createEmptyFundForm = (defaultSector = '') => ({ code: '', sector: defaultSector, amount: '', holdingProfit: '', shares: '' });

const createEmptyFundLookup = () => ({
  status: 'idle',
  message: '输入 6 位基金代码后将自动查询基金名称与最新可用净值。',
  quote: null,
});

const getQuoteReferenceNetValue = (quote) => {
  const estimatedNetValue = toNumber(quote?.estimatedNetValue);
  if (estimatedNetValue > 0) return estimatedNetValue;
  return toNumber(quote?.lastNetValue);
};

const getStoredReferenceNetValue = (fund) => {
  const currentNetValue = toNumber(fund?.currentNetValue);
  if (currentNetValue > 0) return currentNetValue;

  const lastNetValue = toNumber(fund?.lastNetValue);
  if (lastNetValue > 0) return lastNetValue;

  const shares = toNumber(fund?.shares);
  const marketValue = toNumber(fund?.amount);
  if (shares > 0 && marketValue > 0) {
    return marketValue / shares;
  }

  return 0;
};

const buildFundSnapshot = (fund, overrides = {}) => {
  const hasTrackedShares = overrides.shares !== undefined || fund.shares !== undefined;
  const shares = hasTrackedShares ? Math.max(0, toNumber(overrides.shares ?? fund.shares)) : 0;
  const currentNetValue = toNumber(overrides.currentNetValue ?? getStoredReferenceNetValue(fund));
  const lastNetValue = toNumber(overrides.lastNetValue ?? fund.lastNetValue);
  const derivedDailyRate = currentNetValue > 0 && lastNetValue > 0
    ? ((currentNetValue - lastNetValue) / lastNetValue) * 100
    : 0;
  const dailyRate = toNumber(overrides.dailyRate ?? derivedDailyRate);
  const fallbackMarketValue = Math.max(0, toNumber(overrides.amount ?? fund.amount));
  const marketValue = hasTrackedShares
    ? (shares > 0 ? (currentNetValue > 0 ? shares * currentNetValue : fallbackMarketValue) : 0)
    : fallbackMarketValue;
  const fallbackCostAmount = fund.costAmount !== undefined
    ? Math.max(0, toNumber(fund.costAmount))
    : Math.max(0, toNumber(fund.amount));
  const costAmount = hasTrackedShares
    ? (shares > 0 ? Math.max(0, toNumber(overrides.costAmount ?? fallbackCostAmount)) : 0)
    : undefined;
  const canUseRateBasedDailyProfit = marketValue > 0 && dailyRate !== 0 && dailyRate !== -100 && (!hasTrackedShares || shares > 0);
  const hasExplicitDailyProfitOverride = overrides.dailyProfit !== undefined;
  const fallbackDailyProfit = canUseRateBasedDailyProfit
    ? (marketValue * dailyRate) / (100 + dailyRate)
    : (hasExplicitDailyProfitOverride ? toNumber(overrides.dailyProfit) : (dailyRate === 0 ? 0 : toNumber(fund.dailyProfit)));
  const legacyDailyProfit = fallbackDailyProfit;
  const legacyTotalProfit = toNumber(overrides.totalProfit ?? fund.totalProfit);
  const legacyTotalRate = toNumber(overrides.totalRate ?? fund.totalRate);
  const dailyProfit = hasTrackedShares
    ? (shares > 0 && currentNetValue > 0 && lastNetValue > 0 ? shares * (currentNetValue - lastNetValue) : fallbackDailyProfit)
    : legacyDailyProfit;
  const totalProfit = hasTrackedShares
    ? marketValue - costAmount
    : legacyTotalProfit;
  const totalRate = hasTrackedShares
    ? (costAmount > 0 ? (totalProfit / costAmount) * 100 : 0)
    : legacyTotalRate;

  return {
    ...fund,
    ...overrides,
    amount: marketValue,
    shares: hasTrackedShares ? shares : undefined,
    costAmount,
    currentNetValue,
    lastNetValue,
    dailyRate,
    dailyProfit,
    totalProfit,
    totalRate,
    weeklyProfit: toNumber(overrides.weeklyProfit ?? fund.weeklyProfit),
    monthlyProfit: toNumber(overrides.monthlyProfit ?? fund.monthlyProfit),
  };
};

const parseOfficialNetValueRows = (content) => {
  if (!content || typeof content !== 'string') return null;

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(content, 'text/html');
  const rows = [...documentFragment.querySelectorAll('tbody tr')]
    .slice(0, 2)
    .map((row) => {
      const cells = row.querySelectorAll('td');
      const date = String(cells[0]?.textContent || '').trim();
      const netValue = toNumber(cells[1]?.textContent);
      const dailyRate = parsePercentageText(cells[3]?.textContent);

      if (!date || netValue <= 0) {
        return null;
      }

      return {
        date,
        netValue,
        dailyRate,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return null;
  }

  return {
    currentNetValue: rows[0].netValue,
    lastNetValue: rows[1]?.netValue,
    dailyRate: rows[0].dailyRate,
    netValueDate: rows[0].date,
    previousNetValueDate: rows[1]?.date || '',
  };
};

const parseOfficialHistoryRows = (content) => {
  if (!content || typeof content !== 'string') return [];

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(content, 'text/html');

  return [...documentFragment.querySelectorAll('tbody tr')]
    .map((row) => {
      const cells = row.querySelectorAll('td');
      const date = String(cells[0]?.textContent || '').trim();
      const netValue = toNumber(cells[1]?.textContent);
      const dailyRate = parsePercentageText(cells[3]?.textContent);

      if (!date || netValue <= 0) {
        return null;
      }

      return {
        date,
        netValue,
        dailyRate: dailyRate === undefined ? null : dailyRate,
      };
    })
    .filter(Boolean);
};

const applyOfficialNetValueToFund = (fund, officialSnapshot) => {
  if (!officialSnapshot || officialSnapshot.currentNetValue <= 0 || !officialSnapshot.netValueDate) {
    return fund;
  }

  return {
    ...fund,
    officialCurrentNetValue: officialSnapshot.currentNetValue,
    officialLastNetValue: officialSnapshot.lastNetValue,
    officialDailyRate: officialSnapshot.dailyRate,
    officialNetValueDate: officialSnapshot.netValueDate,
    officialPreviousNetValueDate: officialSnapshot.previousNetValueDate || '',
    };
};

const hasUsableOfficialSnapshot = (fund) => {
  return toNumber(fund?.officialCurrentNetValue) > 0 && Boolean(fund?.officialNetValueDate);
};

const buildBaseValuationFund = (fund) => {
  return buildFundSnapshot(fund, {
    currentNetValue: fund.currentNetValue,
    lastNetValue: fund.lastNetValue,
    dailyRate: fund.dailyRate,
  });
};

const buildOfficialValuationFund = (fund) => {
  const shares = Math.max(0, toNumber(fund.shares));
  const costAmount = fund.costAmount !== undefined ? Math.max(0, toNumber(fund.costAmount)) : undefined;
  const currentNetValue = fund.officialCurrentNetValue !== undefined ? Math.max(0, toNumber(fund.officialCurrentNetValue)) : undefined;
  const lastNetValue = fund.officialLastNetValue !== undefined ? Math.max(0, toNumber(fund.officialLastNetValue)) : undefined;
  const storedOfficialDailyRate = fund.officialDailyRate !== undefined ? toNumber(fund.officialDailyRate) : undefined;
  const hasTrackedShares = shares > 0;
  const fallbackAmount = Math.max(0, toNumber(fund.amount));
  const amount = hasTrackedShares && currentNetValue > 0 ? shares * currentNetValue : (fallbackAmount > 0 ? fallbackAmount : null);
  const derivedDailyRate = currentNetValue > 0 && lastNetValue > 0
    ? ((currentNetValue - lastNetValue) / lastNetValue) * 100
    : Number.NaN;
  const dailyRate = Number.isFinite(storedOfficialDailyRate)
    ? storedOfficialDailyRate
    : (Number.isFinite(derivedDailyRate) ? derivedDailyRate : null);
  const canUseRateBasedDailyProfit = Number.isFinite(amount) && Number.isFinite(dailyRate) && dailyRate !== -100;
  const dailyProfit = hasTrackedShares && currentNetValue > 0 && lastNetValue > 0
    ? shares * (currentNetValue - lastNetValue)
    : (canUseRateBasedDailyProfit ? (amount * dailyRate) / (100 + dailyRate) : null);
  const totalProfit = Number.isFinite(amount) && costAmount !== undefined ? amount - costAmount : null;
  const totalRate = Number.isFinite(amount) && costAmount > 0 ? (totalProfit / costAmount) * 100 : (costAmount === 0 && Number.isFinite(amount) ? 0 : null);

  return {
    ...fund,
    amount,
    dailyRate,
    dailyProfit,
    totalProfit,
    totalRate,
    currentNetValue: currentNetValue ?? fund.currentNetValue,
    lastNetValue: lastNetValue ?? fund.lastNetValue,
    netValueDate: fund.officialNetValueDate || fund.netValueDate,
    lastValuationTime: fund.officialNetValueDate || fund.lastValuationTime || '',
  };
};

const shouldPreferOfficialValuation = (fund) => {
  if (!hasUsableOfficialSnapshot(fund)) {
    return false;
  }

  const quoteSource = inferStoredQuoteSource(fund);
  const quoteNetValueDate = typeof fund.netValueDate === 'string' ? fund.netValueDate : '';
  const officialNetValueDate = typeof fund.officialNetValueDate === 'string' ? fund.officialNetValueDate : '';

  if (quoteSource === 'estimate') {
    return Boolean(quoteNetValueDate && officialNetValueDate && officialNetValueDate > quoteNetValueDate);
  }

  if (quoteSource === 'quote') {
    if (quoteNetValueDate && officialNetValueDate) {
      return officialNetValueDate >= quoteNetValueDate;
    }

    return !quoteNetValueDate;
  }

  if (!quoteNetValueDate) {
    return true;
  }

  return Boolean(officialNetValueDate && officialNetValueDate >= quoteNetValueDate);
};

const buildDisplayedFund = (fund) => {
  const quoteSource = inferStoredQuoteSource(fund);

  if (shouldPreferOfficialValuation({ ...fund, quoteSource })) {
    return {
      ...buildOfficialValuationFund(fund),
      quoteSource,
      valuationSource: 'official',
    };
  }

  return {
    ...buildBaseValuationFund(fund),
    quoteSource,
    valuationSource: quoteSource === 'estimate' ? 'estimate' : (quoteSource === 'quote' ? 'quote' : 'fallback'),
  };
};

const getDisplayedReferenceNetValue = (fund) => {
  return getStoredReferenceNetValue(buildDisplayedFund(fund));
};

const deriveSharesFromDisplayedAmount = (fund, amount = fund.amount) => {
  const referenceNetValue = getDisplayedReferenceNetValue(fund);
  const sanitizedAmount = Math.max(0, toNumber(amount));

  if (referenceNetValue <= 0) {
    return null;
  }

  return sanitizedAmount > 0 ? sanitizedAmount / referenceNetValue : 0;
};

const reconcileFundWithQuote = (fund, quote) => {
  const referenceNetValue = getQuoteReferenceNetValue(quote);
  const fallbackMarketValue = Math.max(0, toNumber(fund.amount));
  const shouldBootstrapShares = Boolean(fund.bootstrapSharesFromAmount);
  const hasStoredCostAmount = fund.costAmount !== undefined;
  const existingCostAmount = Math.max(0, toNumber(fund.costAmount));
  const costAmount = hasStoredCostAmount
    ? existingCostAmount
    : (shouldBootstrapShares ? fallbackMarketValue : undefined);

  return buildFundSnapshot(fund, {
    name: quote.name || fund.name,
    code: quote.code || fund.code,
    ...(costAmount !== undefined ? { costAmount } : {}),
    currentNetValue: referenceNetValue,
    lastNetValue: quote.lastNetValue,
    dailyRate: quote.dailyRate,
    quoteSource: getQuoteSourceFromQuote(quote),
    lastValuationTime: quote.updateTime || fund.lastValuationTime || '',
    netValueDate: quote.netValueDate || fund.netValueDate || '',
    bootstrapSharesFromAmount: false,
  });
};

const fetchQuoteMapForFunds = async (fundsToUpdate) => {
  if (!fundsToUpdate || fundsToUpdate.length === 0) {
    return new Map();
  }

  const uniqueCodes = [...new Set(
    fundsToUpdate
      .map((fund) => String(fund.code || '').trim())
      .filter(Boolean)
  )];

  const quoteMap = new Map();

  for (const code of uniqueCodes) {
    try {
      const quote = await enqueueTiantianFundQuote(code);
      quoteMap.set(code, quote);
    } catch (error) {
      console.warn(`天天基金估值刷新失败: ${code}`, error);
    }
  }

  return quoteMap;
};

const mergeFundsWithSources = (fundsToMerge, quoteMap, officialMap) => {
  if (!fundsToMerge || fundsToMerge.length === 0) {
    return fundsToMerge;
  }

  return fundsToMerge.map((fund) => {
    const code = String(fund.code || '').trim();
    const quote = quoteMap.get(code);
    const officialSnapshot = officialMap.get(code);
    let nextFund = fund;

    if (quote) {
      nextFund = reconcileFundWithQuote(nextFund, quote);
    } else if (fund.shares === undefined) {
      nextFund = {
        ...nextFund,
        dailyRate: 0,
        dailyProfit: 0,
      };
    }

    return officialSnapshot ? applyOfficialNetValueToFund(nextFund, officialSnapshot) : nextFund;
  });
};

let tiantianQuoteQueue = Promise.resolve();
let eastmoneyOfficialQueue = Promise.resolve();

const getTodayDateKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadTiantianFundQuote = (fundCode) => {
  return new Promise((resolve, reject) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    const callbackName = 'jsonpgz';
    const previousCallback = window[callbackName];
    const scriptId = `tiantian_quote_${normalizedCode}_${Date.now()}`;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();

      if (previousCallback === undefined) {
        delete window[callbackName];
      } else {
        window[callbackName] = previousCallback;
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 估值请求超时`));
    }, SCRIPT_TIMEOUT_MS);

    window[callbackName] = (payload) => {
      const payloadCode = String(payload?.fundcode || '').trim();
      if (payloadCode && payloadCode !== normalizedCode) {
        return;
      }

      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        code: payloadCode || normalizedCode,
        name: payload?.name || '',
        lastNetValue: toNumber(payload?.dwjz),
        estimatedNetValue: toNumber(payload?.gsz),
        dailyRate: toNumber(payload?.gszzl),
        updateTime: payload?.gztime || '',
        netValueDate: payload?.jzrq || '',
        quoteSource: toNumber(payload?.gsz) > 0 ? 'estimate' : (toNumber(payload?.dwjz) > 0 ? 'quote' : ''),
      });
    };

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://fundgz.1234567.com.cn/js/${normalizedCode}.js?rt=${Date.now()}`;
    script.async = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 估值加载失败`));
    };

    document.body.appendChild(script);
  });
};

const enqueueTiantianFundQuote = (fundCode) => {
  const task = tiantianQuoteQueue.then(() => loadTiantianFundQuote(fundCode));
  tiantianQuoteQueue = task.then(() => undefined, () => undefined);
  return task;
};

const loadEastmoneyOfficialHistory = (fundCode) => {
  return new Promise((resolve, reject) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    const scriptId = `eastmoney_official_${normalizedCode}_${Date.now()}`;
    const previousApiData = window.apidata;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();

      window.apidata = previousApiData;
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 官方净值请求超时`));
    }, SCRIPT_TIMEOUT_MS);

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${normalizedCode}&page=1&per=2&rt=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (settled) return;
      settled = true;

      const parsed = parseOfficialNetValueRows(window.apidata?.content);
      cleanup();

      if (!parsed) {
        reject(new Error(`基金 ${normalizedCode} 官方净值解析失败`));
        return;
      }

      resolve({
        code: normalizedCode,
        ...parsed,
      });
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 官方净值加载失败`));
    };

    document.body.appendChild(script);
  });
};

const enqueueEastmoneyOfficialHistory = (fundCode) => {
  const task = eastmoneyOfficialQueue.then(() => loadEastmoneyOfficialHistory(fundCode));
  eastmoneyOfficialQueue = task.then(() => undefined, () => undefined);
  return task;
};

const loadEastmoneyOfficialHistoryRange = (fundCode, per = 1200) => {
  return new Promise((resolve, reject) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    const scriptId = `eastmoney_official_range_${normalizedCode}_${Date.now()}`;
    const previousApiData = window.apidata;
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();
      window.apidata = previousApiData;
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 官方历史请求超时`));
    }, SCRIPT_TIMEOUT_MS);

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${normalizedCode}&page=1&per=${per}&rt=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (settled) return;
      settled = true;

      const history = parseOfficialHistoryRows(window.apidata?.content);
      cleanup();

      if (history.length === 0) {
        reject(new Error(`基金 ${normalizedCode} 官方历史解析失败`));
        return;
      }

      resolve({
        code: normalizedCode,
        history,
      });
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 官方历史加载失败`));
    };

    document.body.appendChild(script);
  });
};

const enqueueEastmoneyOfficialHistoryRange = (fundCode, per = 1200) => {
  const task = eastmoneyOfficialQueue.then(() => loadEastmoneyOfficialHistoryRange(fundCode, per));
  eastmoneyOfficialQueue = task.then(() => undefined, () => undefined);
  return task;
};

const fetchFundDetailRemoteData = async (fundCode) => {
  const normalizedCode = String(fundCode || '').trim();
  const [quoteResult, historyResult] = await Promise.allSettled([
    enqueueTiantianFundQuote(normalizedCode),
    enqueueEastmoneyOfficialHistoryRange(normalizedCode),
  ]);

  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const officialHistory = historyResult.status === 'fulfilled' ? historyResult.value.history : [];

  if (!quote && officialHistory.length === 0) {
    const quoteError = quoteResult.status === 'rejected' ? quoteResult.reason?.message : '';
    const historyError = historyResult.status === 'rejected' ? historyResult.reason?.message : '';
    throw new Error(historyError || quoteError || '基金详情获取失败');
  }

  return buildDetailCacheEntry({
    code: normalizedCode,
    quote,
    officialHistory,
    remoteThemes: [],
  });
};

const fetchOfficialMapForFunds = async (fundsToUpdate) => {
  if (!fundsToUpdate || fundsToUpdate.length === 0) {
    return new Map();
  }

  const uniqueCodes = [...new Set(
    fundsToUpdate
      .map((fund) => String(fund.code || '').trim())
      .filter(Boolean)
  )];

  const officialMap = new Map();

  for (const code of uniqueCodes) {
    try {
      const officialSnapshot = await enqueueEastmoneyOfficialHistory(code);
      officialMap.set(code, officialSnapshot);
    } catch (error) {
      console.warn(`天天基金官方净值刷新失败: ${code}`, error);
    }
  }

  return officialMap;
};

const alignFundMarketValue = async (fund, nextMarketValue, fallbackName = fund.name) => {
  const sanitizedMarketValue = Math.max(0, toNumber(nextMarketValue));

  try {
    const quote = await enqueueTiantianFundQuote(fund.code);
    const quoteAlignedFund = reconcileFundWithQuote({ ...fund, name: fallbackName }, quote);
    const derivedShares = deriveSharesFromDisplayedAmount(quoteAlignedFund, sanitizedMarketValue);

    if (derivedShares !== null) {
      return buildFundSnapshot(quoteAlignedFund, {
        name: quote.name || fallbackName,
        shares: derivedShares,
        costAmount: toNumber(fund.costAmount) > 0 ? toNumber(fund.costAmount) : sanitizedMarketValue,
      });
    }
  } catch (error) {
    console.warn(`持仓市值校准失败: ${fund.code}`, error);
  }

  const fallbackShares = deriveSharesFromDisplayedAmount(fund, sanitizedMarketValue);
  if (fallbackShares !== null) {
    return buildFundSnapshot({ ...fund, name: fallbackName }, {
      name: fallbackName,
      amount: sanitizedMarketValue,
      shares: fallbackShares,
      costAmount: toNumber(fund.costAmount) > 0 ? toNumber(fund.costAmount) : sanitizedMarketValue,
    });
  }

  return {
    ...fund,
    name: fallbackName,
    amount: sanitizedMarketValue,
    costAmount: toNumber(fund.costAmount) > 0 ? toNumber(fund.costAmount) : sanitizedMarketValue,
  };
};

const applyTradeToFund = (fund, trade, quote) => {
  const normalizedFund = quote ? reconcileFundWithQuote(fund, quote) : { ...fund, quoteSource: inferStoredQuoteSource(fund) };
  const referenceNetValue = getDisplayedReferenceNetValue(normalizedFund);
  const tradeAmount = Math.max(0, toNumber(trade.amount));
  const todayKey = getTodayDateKey();

  if (referenceNetValue <= 0 || tradeAmount <= 0) {
    return normalizedFund;
  }

  const currentShares = Math.max(0, toNumber(normalizedFund.shares) || deriveSharesFromDisplayedAmount(normalizedFund) || 0);
  const currentCostAmount = Math.max(0, toNumber(normalizedFund.costAmount));
  let nextShares = currentShares;
  let nextCostAmount = currentCostAmount;

  if (trade.type === '买入') {
    nextShares += tradeAmount / referenceNetValue;
    nextCostAmount += tradeAmount;
  } else if (trade.type === '卖出') {
    if (currentShares <= 0) {
      return normalizedFund;
    }

    const soldShares = Math.min(currentShares, tradeAmount / referenceNetValue);
    const soldRatio = currentShares > 0 ? soldShares / currentShares : 0;
    nextShares = Math.max(0, currentShares - soldShares);
    nextCostAmount = Math.max(0, currentCostAmount - currentCostAmount * soldRatio);
  } else if (trade.type === '分红') {
    nextCostAmount = Math.max(0, currentCostAmount - tradeAmount);
  }

  return buildFundSnapshot(normalizedFund, {
    name: quote?.name || normalizedFund.name,
    shares: nextShares,
    costAmount: nextCostAmount,
    holdingStartDate: trade.type === '买入'
      ? (normalizedFund.holdingStartDate || todayKey)
      : (trade.type === '卖出' && nextShares === 0 ? '' : normalizedFund.holdingStartDate),
  });
};

const alignFundSharesToDisplayedAmount = (fund, targetAmount) => {
  const sanitizedAmount = Math.max(0, toNumber(targetAmount));
  const derivedShares = deriveSharesFromDisplayedAmount(fund, sanitizedAmount);

  if (derivedShares === null) {
    return {
      ...fund,
      amount: sanitizedAmount,
      bootstrapSharesFromAmount: false,
    };
  }

  return {
    ...fund,
    amount: sanitizedAmount,
    shares: derivedShares,
    bootstrapSharesFromAmount: false,
  };
};
// ============================================================================

export default function FundTrackerApp() {
  
  // 1. 初始化持仓：从 localStorage 读取，若无则默认为空数组 []
  const [funds, setFunds] = useState(() => {
    return normalizeStoredFunds(readStoredJson('fundTrackerData', []));
  });
  const [detailCacheEntries, setDetailCacheEntries] = useState(() => {
    return normalizeStoredDetailCacheStore(readStoredJson(DETAIL_CACHE_STORAGE_KEY, {})).entries;
  });

  // 2. 初始化分组
  const [sectors, setSectors] = useState(() => {
    return normalizeStoredSectors(readStoredJson('fundTrackerSectors', INITIAL_SECTORS));
  });

  // 3. 监听变化：只要持仓变了，立刻存入本地缓存
  useEffect(() => {
    localStorage.setItem('fundTrackerData', JSON.stringify(funds));
  }, [funds]);

  useEffect(() => {
    localStorage.setItem(DETAIL_CACHE_STORAGE_KEY, JSON.stringify(buildStoredDetailCachePayload(detailCacheEntries)));
  }, [detailCacheEntries]);

  // 4. 监听变化：只要分组变了，立刻存入本地缓存
  useEffect(() => {
    localStorage.setItem('fundTrackerSectors', JSON.stringify(sectors));
  }, [sectors]);


  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [selectedFund, setSelectedFund] = useState(null);
  const [detailView, setDetailView] = useState({ isOpen: false, code: '' });
  const [detailRequestStates, setDetailRequestStates] = useState({});
  const hasAutoRefreshedRef = useRef(false);
  const fundLookupRequestRef = useRef(0);
  const groupTableRef = useRef(null);

  const [modals, setModals] = useState({
    group: false, fund: false, sync: false, import: false, export: false, history: false, settings: false
  });

  const openModal = (type) => setModals(prev => ({ ...prev, [type]: true }));
  const closeModal = (type) => setModals(prev => ({ ...prev, [type]: false }));

  const [newGroupName, setNewGroupName] = useState('');
  const [fundForm, setFundForm] = useState(() => createEmptyFundForm(sectors[0] || ''));
  const [fundLookup, setFundLookup] = useState(createEmptyFundLookup);
  const [syncForm, setSyncForm] = useState({ code: '', type: '买入', amount: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', code: '', sector: '', amount: '' });

  const normalizedFundCode = String(fundForm.code || '').trim();
  const normalizedFundSector = String(fundForm.sector || '').trim();
  const hasHoldingAmountInput = String(fundForm.amount || '').trim() !== '';
  const hasHoldingProfitInput = String(fundForm.holdingProfit || '').trim() !== '';
  const hasHoldingSharesInput = String(fundForm.shares || '').trim() !== '';
  const holdingAmountValue = hasHoldingAmountInput ? Number.parseFloat(fundForm.amount) : Number.NaN;
  const holdingProfitValue = hasHoldingProfitInput ? Number.parseFloat(fundForm.holdingProfit) : Number.NaN;
  const holdingSharesValue = hasHoldingSharesInput ? Number.parseFloat(fundForm.shares) : Number.NaN;
  const derivedCostAmountRaw = Number.isFinite(holdingAmountValue) && Number.isFinite(holdingProfitValue)
    ? holdingAmountValue - holdingProfitValue
    : Number.NaN;
  const derivedCostAmount = Number.isFinite(derivedCostAmountRaw)
    ? Math.max(0, derivedCostAmountRaw)
    : Number.NaN;
  const isHoldingAmountValid = Number.isFinite(holdingAmountValue) && holdingAmountValue > 0;
  const isHoldingProfitValid = Number.isFinite(holdingProfitValue);
  const isHoldingSharesValid = !hasHoldingSharesInput || (Number.isFinite(holdingSharesValue) && holdingSharesValue > 0);
  const isDerivedCostAmountValid = Number.isFinite(derivedCostAmountRaw) && derivedCostAmountRaw >= 0;
  const isFundSectorValid = Boolean(normalizedFundSector) && sectors.includes(normalizedFundSector);
  const canSubmitFund = fundLookup.status === 'success' && isHoldingAmountValid && isHoldingProfitValid && isHoldingSharesValid && isDerivedCostAmountValid && isFundSectorValid;

  const resetFundModalState = useCallback(() => {
    const defaultSector = sectors[0] || '';
    fundLookupRequestRef.current += 1;
    setFundForm(createEmptyFundForm(defaultSector));
    setFundLookup(createEmptyFundLookup());
  }, [sectors]);

  const handleOpenFundModal = () => {
    resetFundModalState();
    openModal('fund');
  };

  const handleCloseFundModal = () => {
    resetFundModalState();
    closeModal('fund');
  };

  const handleFundCodeChange = (value) => {
    const nextCode = String(value || '').trim();
    fundLookupRequestRef.current += 1;

    setFundForm((current) => ({
      ...current,
      code: nextCode,
    }));

    if (!nextCode) {
      setFundLookup(createEmptyFundLookup());
      return;
    }

    if (/^\d{1,5}$/.test(nextCode)) {
      setFundLookup({
        status: 'idle',
        message: '输入满 6 位基金代码后将自动查询基金名称与最新可用净值。',
        quote: null,
      });
      return;
    }

    if (!/^\d{6}$/.test(nextCode)) {
      setFundLookup({
        status: 'error',
        message: '请输入正确的 6 位基金代码后再查询。',
        quote: null,
      });
      return;
    }

    setFundLookup({
      status: 'loading',
      message: `正在查询 ${nextCode} 的基金信息...`,
      quote: null,
    });
  };

  const displayedFunds = useMemo(() => {
    return funds.map((fund) => ({
      ...buildDisplayedFund(fund),
      sourceFund: fund,
    }));
  }, [funds]);

  const latestOfficialDate = useMemo(() => {
    return funds.reduce((latestDate, fund) => {
      if (fund.officialNetValueDate && fund.officialNetValueDate > latestDate) {
        return fund.officialNetValueDate;
      }

      return latestDate;
    }, '');
  }, [funds]);

  const valuationSourceSummary = useMemo(() => {
    return displayedFunds.reduce((summary, fund) => {
      const key = fund.valuationSource === 'official' || fund.valuationSource === 'estimate' || fund.valuationSource === 'quote'
        ? fund.valuationSource
        : 'fallback';
      summary[key] += 1;
      return summary;
    }, { official: 0, estimate: 0, quote: 0, fallback: 0 });
  }, [displayedFunds]);

  const valuationSourceHint = [
    valuationSourceSummary.estimate > 0 ? `${valuationSourceSummary.estimate} 支盘中估值` : '',
    valuationSourceSummary.official > 0 ? `${valuationSourceSummary.official} 支官方净值` : '',
    valuationSourceSummary.quote > 0 ? `${valuationSourceSummary.quote} 支最新净值` : '',
    valuationSourceSummary.fallback > 0 ? `${valuationSourceSummary.fallback} 支回退快照` : '',
  ].filter(Boolean).join(' · ');

  const updateBadgeText = [
    lastUpdateTime ? `最近刷新 ${lastUpdateTime}` : '',
    latestOfficialDate ? `官方净值截止 ${latestOfficialDate}` : '',
  ].filter(Boolean).join(' · ');

  const dailySummaryLabel = '当日盈亏 (元)';
  const dailyRateColumnLabel = '当日涨幅';
  const dailyProfitColumnLabel = '当日收益';
  const groupDailyLabel = '当日盈亏';
  const refreshButtonLabel = '刷新数据';

  // --- 数据计算与分组 ---
  const { groupedFunds, totalDailyProfit, totalAmount, totalProfit } = useMemo(() => {
    let tDaily = 0;
    let tAmount = 0;
    let tProfit = 0;
    let hasIncompleteDaily = false;
    let hasIncompleteAmount = false;
    let hasIncompleteProfit = false;
    
    const groups = sectors.reduce((acc, sector) => {
      acc[sector] = { funds: [], sectorDailyProfit: 0, sectorAmount: 0, sectorTotalProfit: 0, hasIncompleteDaily: false, hasIncompleteAmount: false, hasIncompleteProfit: false };
      return acc;
    }, {});

    displayedFunds.forEach((fund) => {
      const targetSector = groups[fund.sector] ? fund.sector : (groups.其他 ? '其他' : sectors[0]);
      
      if (!groups[targetSector]) {
         groups[targetSector] = { funds: [], sectorDailyProfit: 0, sectorAmount: 0, sectorTotalProfit: 0, hasIncompleteDaily: false, hasIncompleteAmount: false, hasIncompleteProfit: false };
      }

      groups[targetSector].funds.push(fund);

      if (Number.isFinite(fund.dailyProfit)) {
        groups[targetSector].sectorDailyProfit += fund.dailyProfit;
        tDaily += fund.dailyProfit;
      } else {
        groups[targetSector].hasIncompleteDaily = true;
        hasIncompleteDaily = true;
      }

      if (Number.isFinite(fund.amount)) {
        groups[targetSector].sectorAmount += fund.amount;
        tAmount += fund.amount;
      } else {
        groups[targetSector].hasIncompleteAmount = true;
        hasIncompleteAmount = true;
      }

      if (Number.isFinite(fund.totalProfit)) {
        groups[targetSector].sectorTotalProfit += fund.totalProfit;
        tProfit += fund.totalProfit;
      } else {
        groups[targetSector].hasIncompleteProfit = true;
        hasIncompleteProfit = true;
      }
    });

    return {
      groupedFunds: groups,
      totalDailyProfit: hasIncompleteDaily ? null : tDaily,
      totalAmount: hasIncompleteAmount ? null : tAmount,
      totalProfit: hasIncompleteProfit ? null : tProfit,
    };
  }, [displayedFunds, sectors]);

  const activeDetailSourceFund = useMemo(() => {
    if (!detailView.code) return null;
    return funds.find((fund) => String(fund.code || '').trim() === detailView.code) ?? null;
  }, [detailView.code, funds]);

  const activeDetailDisplayedFund = useMemo(() => {
    if (!detailView.code) return null;
    return displayedFunds.find((fund) => String(fund.code || '').trim() === detailView.code) ?? null;
  }, [detailView.code, displayedFunds]);

  const activeDetailEntry = detailView.code ? detailCacheEntries[detailView.code] ?? null : null;
  const activeDetailRequestState = detailView.code
    ? (detailRequestStates[detailView.code] ?? { isLoading: false, error: '' })
    : { isLoading: false, error: '' };

  const activeDetailModel = useMemo(() => {
    if (!activeDetailSourceFund || !activeDetailDisplayedFund) return null;

    return buildFundDetailModel({
      sourceFund: activeDetailSourceFund,
      displayedFund: activeDetailDisplayedFund,
      totalPortfolioAmount: totalAmount,
      detailEntry: activeDetailEntry,
    });
  }, [activeDetailDisplayedFund, activeDetailEntry, activeDetailSourceFund, totalAmount]);

  const orderedGroups = useMemo(() => {
    return sectors.map((sector) => ({
      sector,
      data: groupedFunds[sector] ?? {
        funds: [],
        sectorDailyProfit: 0,
        sectorAmount: 0,
        sectorTotalProfit: 0,
        hasIncompleteDaily: false,
        hasIncompleteAmount: false,
        hasIncompleteProfit: false,
      },
    }));
  }, [groupedFunds, sectors]);

  const refreshFundDetail = useCallback(async (fundCode, { force = false } = {}) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) return;

    const existingEntry = detailCacheEntries[normalizedCode];
    if (!force && existingEntry && !isDetailCacheStale(existingEntry)) {
      return;
    }

    setDetailRequestStates((currentStates) => ({
      ...currentStates,
      [normalizedCode]: { isLoading: true, error: '' },
    }));

    try {
      const detailEntry = await fetchFundDetailRemoteData(normalizedCode);
      setDetailCacheEntries((currentEntries) => ({
        ...currentEntries,
        [normalizedCode]: detailEntry,
      }));
      setDetailRequestStates((currentStates) => ({
        ...currentStates,
        [normalizedCode]: { isLoading: false, error: '' },
      }));
    } catch (error) {
      setDetailRequestStates((currentStates) => ({
        ...currentStates,
        [normalizedCode]: {
          isLoading: false,
          error: error?.message || '基金详情刷新失败，请稍后重试。',
        },
      }));
    }
  }, [detailCacheEntries]);

  const handleOpenFundDetail = useCallback((fund) => {
    const normalizedCode = String(fund?.code || fund?.sourceFund?.code || '').trim();
    if (!normalizedCode) return;

    setDetailView({ isOpen: true, code: normalizedCode });
    void refreshFundDetail(normalizedCode);
  }, [refreshFundDetail]);

  const handleCloseFundDetail = useCallback(() => {
    setDetailView({ isOpen: false, code: '' });
  }, []);

  const handleRefreshFundDetail = useCallback(async () => {
    if (!detailView.code) return;
    await refreshFundDetail(detailView.code, { force: true });
  }, [detailView.code, refreshFundDetail]);

  // --- 交互处理 ---
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const [quoteMap, officialMap] = await Promise.all([
        fetchQuoteMapForFunds(funds),
        fetchOfficialMapForFunds(funds),
      ]);

      if (quoteMap.size > 0 || officialMap.size > 0) {
        setFunds((currentFunds) => mergeFundsWithSources(currentFunds, quoteMap, officialMap));

        const now = new Date();
        setLastUpdateTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [funds]);

  useEffect(() => {
    if (hasAutoRefreshedRef.current || funds.length === 0) {
      return;
    }

    hasAutoRefreshedRef.current = true;
    handleRefresh();
  }, [funds.length, handleRefresh]);

  const toggleGroup = (sector) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  const handleSectorSortEnd = useCallback(() => {
    // Derive the final order from the DOM order after drag ends.
    const tableElement = groupTableRef.current;
    if (!tableElement) {
      return;
    }

    const domOrder = Array.from(tableElement.querySelectorAll('tbody[data-sector]'))
      .map((section) => section.dataset.sector);

    // Update sectors only if the DOM order differs from the current logical order.
    setSectors((current) => {
      if (!Array.isArray(current)) return current;
      if (domOrder.length !== current.length) return current;
      const isSame = domOrder.every((sec, idx) => sec === current[idx]);
      return isSame ? current : domOrder;
    });
  }, []);

  useEffect(() => {
    const tableElement = groupTableRef.current;
    if (!tableElement) {
      return undefined;
    }

    const sortable = Sortable.create(tableElement, {
      draggable: 'tbody[data-sector]',
      handle: '[data-drag-handle]',
      animation: 180,
      direction: 'vertical',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      onEnd: handleSectorSortEnd,
    });

    return () => {
      sortable.destroy();
    };
  }, [handleSectorSortEnd]);

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (!sectors.includes(newGroupName.trim())) {
      setSectors([...sectors, newGroupName.trim()]);
    }
    setNewGroupName('');
    closeModal('group');
  };

  useEffect(() => {
    if (!modals.fund || !/^\d{6}$/.test(normalizedFundCode)) {
      return;
    }

    const requestId = fundLookupRequestRef.current;

    const timerId = window.setTimeout(async () => {
      try {
        const quote = await enqueueTiantianFundQuote(normalizedFundCode);
        const resolvedCode = String(quote?.code || '').trim();
        const resolvedName = String(quote?.name || '').trim();
        const referenceNetValue = getQuoteReferenceNetValue(quote);

        if (fundLookupRequestRef.current !== requestId) {
          return;
        }

        if (resolvedCode && resolvedCode !== normalizedFundCode) {
          setFundLookup({
            status: 'error',
            message: '查询结果与当前基金代码不匹配，请重新输入后再试。',
            quote: null,
          });
          return;
        }

        if (!resolvedName || referenceNetValue <= 0) {
          setFundLookup({
            status: 'error',
            message: '已查到代码，但缺少可用基金名称或净值/估值，暂时无法新增。',
            quote: null,
          });
          return;
        }

        setFundLookup({
          status: 'success',
          message: `基金名称已自动匹配：${resolvedName}`,
          quote,
        });
      } catch (error) {
        if (fundLookupRequestRef.current !== requestId) {
          return;
        }

        setFundLookup({
          status: 'error',
          message: error?.message || '基金查询失败，请稍后重试。',
          quote: null,
        });
      }
    }, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [modals.fund, normalizedFundCode]);

  const handleAddFund = async (e) => {
    e.preventDefault();

    if (!canSubmitFund || !fundLookup.quote) {
      alert('请先确认基金代码查询成功，并检查分组、持仓金额、持有收益与可选份额填写是否有效。');
      return;
    }

    const hasDuplicateFund = funds.some((fund) => String(fund.code || '').trim() === normalizedFundCode);
    if (hasDuplicateFund) {
      alert('这只基金已经在持仓列表里了。请用“同步交易”调整仓位，或到“设置”里修改现有持仓。');
      return;
    }

    const manualShares = hasHoldingSharesInput ? holdingSharesValue : undefined;
    const nextFund = reconcileFundWithQuote({
      id: Date.now(),
      name: String(fundLookup.quote.name || '').trim() || '未命名基金',
      code: normalizedFundCode,
      sector: normalizedFundSector,
      amount: holdingAmountValue,
      shares: manualShares,
      costAmount: derivedCostAmount,
      currentNetValue: 0,
      lastNetValue: 0,
      lastValuationTime: '',
      netValueDate: '',
      bootstrapSharesFromAmount: manualShares === undefined,
      dailyRate: 0,
      dailyProfit: 0,
      totalProfit: 0,
      totalRate: 0,
      weeklyProfit: 0,
      monthlyProfit: 0,
      holdingStartDate: getTodayDateKey(),
    }, fundLookup.quote);

    let newFund = nextFund;
    try {
      const officialSnapshot = await enqueueEastmoneyOfficialHistory(normalizedFundCode);
      newFund = applyOfficialNetValueToFund(nextFund, officialSnapshot);
    } catch (error) {
      console.warn(`新增持仓时获取官方净值失败: ${normalizedFundCode}`, error);
    }

    if (manualShares === undefined) {
      newFund = alignFundSharesToDisplayedAmount(newFund, holdingAmountValue);
    }

    setFunds(prev => [...prev, newFund]);

    handleCloseFundModal();
    
    if (collapsedGroups.has(newFund.sector)) {
      toggleGroup(newFund.sector);
    }
  };

  const handleSyncTrade = async (e) => {
    e.preventDefault();

    const normalizedCode = String(syncForm.code || '').trim();
    const existingFundIndex = funds.findIndex(f => String(f.code || '').trim() === normalizedCode);

    if (existingFundIndex === -1) {
      alert('未找到对应的基金代码，请先新增持仓再同步交易。');
      return;
    }

    const targetFund = funds[existingFundIndex];
    let quote = null;

    try {
      quote = await enqueueTiantianFundQuote(targetFund.code);
    } catch (error) {
      console.warn(`同步交易时获取估值失败: ${targetFund.code}`, error);
    }

    const tradeReferenceFund = quote ? reconcileFundWithQuote(targetFund, quote) : { ...targetFund, quoteSource: inferStoredQuoteSource(targetFund) };

    if (getDisplayedReferenceNetValue(tradeReferenceFund) <= 0) {
      alert('暂时无法获取这只基金的可用净值，无法按份额口径同步交易，请先刷新数据后再试。');
      return;
    }

    setFunds((currentFunds) => currentFunds.map((fund) => {
      if (fund.id !== targetFund.id) {
        return fund;
      }

      return applyTradeToFund(fund, {
        type: syncForm.type,
        amount: syncForm.amount,
      }, quote);
    }));

    closeModal('sync');
    setSyncForm({ code: '', type: '买入', amount: '' });
  };

  const handleOpenHistory = (fund) => {
    setSelectedFund(fund);
    openModal('history');
  };

  const handleOpenSettings = (fund) => {
    const sourceFund = fund.sourceFund ?? fund;
    setEditForm({
      ...sourceFund,
      amount: Number.isFinite(fund.amount) ? fund.amount : sourceFund.amount,
    });
    openModal('settings');
  };

  const handleUpdateFund = async (e) => {
    e.preventDefault();

    const nextFunds = await Promise.all(funds.map(async (fund) => {
      if (fund.id !== editForm.id) {
        return fund;
      }

      const updatedFund = await alignFundMarketValue({
        ...fund,
        name: editForm.name,
        code: editForm.code,
        sector: editForm.sector,
      }, editForm.amount, editForm.name);

      return {
        ...updatedFund,
        sector: editForm.sector,
      };
    }));

    const updatedTarget = nextFunds.find((fund) => fund.id === editForm.id);
    if (updatedTarget) {
      setFunds((currentFunds) => currentFunds.map((fund) => (
        fund.id === editForm.id ? updatedTarget : fund
      )));
    }
    closeModal('settings');
  };

  const handleDeleteFund = () => {
    if (detailView.code && String(editForm.code || '').trim() === detailView.code) {
      handleCloseFundDetail();
    }
    setFunds((currentFunds) => currentFunds.filter((fund) => fund.id !== editForm.id));
    closeModal('settings');
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 gap-6 h-full">
        
        {/* --- 顶部 Header 与 核心指标 --- */}
        <header className="flex-shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-red-500 w-7 h-7" />
              养基宝 <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-md">V1.3.0</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-slate-500 text-sm">全天候追踪您的基金投资组合表现</p>
              {updateBadgeText && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  <Clock className="w-3 h-3" /> {updateBadgeText}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-6 lg:gap-8 mt-4 lg:mt-0">
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">总持有金额 (元)</span>
              <span className="text-xl lg:text-2xl font-bold text-slate-900">
                {formatCurrencyAmount(totalAmount)}
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-200 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">累计总收益</span>
              <span className="text-lg lg:text-xl font-bold">
                <FormatNumber value={totalProfit} isCurrency={true} />
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-200 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">{dailySummaryLabel}</span>
              <span className="text-2xl lg:text-3xl font-black">
                <FormatNumber value={totalDailyProfit} isCurrency={true} />
              </span>
            </div>
          </div>
        </header>

        {/* --- 工具栏 --- */}
        <div className="flex-shrink-0 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleOpenFundModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm">
              <Plus className="w-4 h-4" /> 新增持仓
            </button>
            <button type="button" onClick={() => openModal('group')} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-indigo-200">
              <FolderPlus className="w-4 h-4" /> 创建分组
            </button>
            <button type="button" onClick={() => openModal('sync')} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <ArrowRightLeft className="w-4 h-4" /> 同步交易
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">自动口径</span>
              <span className="mx-2 text-slate-300">·</span>
              <span>{valuationSourceHint || '刷新后自动选择可用估值'}</span>
            </div>
            <button type="button" onClick={() => openModal('import')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button type="button" onClick={() => openModal('export')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <Download className="w-4 h-4" /> 导出
            </button>
            <button type="button" onClick={handleRefresh} disabled={funds.length === 0} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200 ml-0 lg:ml-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              {refreshButtonLabel}
            </button>
          </div>
        </div>

        {/* --- 主体表格区 --- */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px] overflow-hidden">
          <div className="flex-1 overflow-auto relative custom-scrollbar">
            <table ref={groupTableRef} className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider shadow-[0_1px_0_0_#e2e8f0]">
                  <th className="p-4 font-medium bg-slate-50">基金名称 (代码)</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持有金额</th>
                  <th className="p-4 font-medium text-right bg-slate-50">{dailyRateColumnLabel}</th>
                  <th className="p-4 font-medium text-right bg-blue-50/80">{dailyProfitColumnLabel}</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持有收益率</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持有总收益</th>
                  <th className="p-4 font-medium text-right bg-slate-50">本周收益</th>
                  <th className="p-4 font-medium text-right bg-slate-50">本月收益</th>
                  <th className="p-4 font-medium text-center bg-slate-50">操作</th>
                </tr>
              </thead>
              {orderedGroups.map(({ sector, data }) => {
                  const isCollapsed = collapsedGroups.has(sector);
                  return (
  <tbody key={sector} data-sector={sector} id={`sector-body-${sector}`}>
                      <tr className="bg-slate-100/70 border-b border-slate-200 group hover:bg-slate-100 transition-colors">
                        <td colSpan={9} className="p-0">
                          <div className="flex items-stretch">
                            <button
                              type="button"
                              data-drag-handle
                              className="flex shrink-0 cursor-grab items-center justify-center border-r border-slate-200 px-3 text-slate-400 transition-colors hover:bg-white/80 hover:text-blue-600 active:cursor-grabbing"
                              aria-label={`拖拽排序分组 ${sector}`}
                              title="拖拽排序"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="group flex w-full items-center justify-between px-4 py-2.5 border-l-4 border-blue-500 cursor-pointer select-none text-left"
                              onClick={() => toggleGroup(sector)}
                              aria-expanded={!isCollapsed}
                              aria-controls={`sector-body-${sector}`}
                            >
                              <span className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                                {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                                <Wallet className="w-4 h-4 text-slate-500" />
                                {sector}
                                <span className="text-xs font-normal text-slate-500 ml-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  {data.funds.length} 支
                                </span>
                              </span>
                              <div className="flex items-center gap-6 text-sm pr-4">
                                <span className="text-slate-500">板块持有金额: <span className="font-medium text-slate-800">{data.hasIncompleteAmount ? '--' : formatCurrencyAmount(data.sectorAmount)}</span></span>
                                <span className="text-slate-500">{groupDailyLabel}: </span>
                                <span className="text-base">
                                  <FormatNumber value={data.hasIncompleteDaily ? null : data.sectorDailyProfit} isCurrency={true} />
                                </span>
                              </div>
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {!isCollapsed && data.funds.length === 0 && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={9} className="p-6 text-center text-sm text-slate-400 bg-white">
                            该分组下暂无持仓
                          </td>
                        </tr>
                      )}

                      {!isCollapsed && data.funds.map((fund) => (
                        <tr key={fund.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors bg-white" data-testid={`fund-row-${fund.code}`}>
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={() => handleOpenFundDetail(fund)}
                              className="text-left"
                              data-testid={`open-fund-detail-${fund.code}`}
                            >
                              <div className="font-medium text-slate-800 transition-colors hover:text-blue-700">{fund.name}</div>
                            </button>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {fund.code}
                              {toNumber(fund.shares) > 0 && ` · ${toNumber(fund.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份`}
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium text-slate-700">
                            {formatCurrencyAmount(fund.amount)}
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.dailyRate} isPercent={true} />
                          </td>
                          <td className="p-4 text-right bg-blue-50/10 font-bold text-base">
                            <FormatNumber value={fund.dailyProfit} isCurrency={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.totalRate} isPercent={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.totalProfit} isCurrency={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.weeklyProfit} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.monthlyProfit} />
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenFundDetail(fund)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                title="详情"
                                data-testid={`detail-entry-${fund.code}`}
                              >
                                详情
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleOpenHistory(fund)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" 
                                title="交易记录"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleOpenSettings(fund)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" 
                                title="设置"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )
                })}
            </table>
          </div>
  {funds.length === 0 && sectors.length === 0 && (
             <div className="p-12 text-center text-slate-500 absolute inset-0 flex items-center justify-center pointer-events-none mt-10">
               暂无基金持仓数据，请点击上方“新增持仓”添加
             </div>
          )}
        </div>
      </div>

      <FundDetailPanel
        isOpen={detailView.isOpen}
        onClose={handleCloseFundDetail}
        onRefresh={handleRefreshFundDetail}
        detailModel={activeDetailModel}
        isLoading={activeDetailRequestState.isLoading}
        hasStaleCache={Boolean(activeDetailEntry) && !activeDetailRequestState.isLoading && Boolean(activeDetailRequestState.error)}
        errorMessage={activeDetailEntry ? '' : activeDetailRequestState.error}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .add-fund-number-input::-webkit-outer-spin-button,
        .add-fund-number-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .add-fund-number-input { appearance: textfield; -moz-appearance: textfield; }
      `}</style>

      <Modal isOpen={modals.group} onClose={() => closeModal('group')} title="创建新分组">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label htmlFor="group-name" className="block text-sm font-medium text-slate-700 mb-1">分组名称</label>
            <input 
              id="group-name" type="text" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="如：海外QDII、固收+" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => closeModal('group')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">确认创建</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modals.fund} onClose={handleCloseFundModal} title="新增基金持仓" maxWidth="max-w-lg">
        <form onSubmit={handleAddFund} className="space-y-4">
          <div>
            <label htmlFor="fund-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
            <input 
              id="fund-code" type="text" required value={fundForm.code} onChange={(e) => handleFundCodeChange(e.target.value)}
              placeholder="如：005827"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="mt-2 space-y-1">
              <p className={`flex items-center gap-2 text-sm ${fundLookup.status === 'success' ? 'text-emerald-700' : fundLookup.status === 'error' ? 'text-rose-700' : fundLookup.status === 'loading' ? 'text-blue-700' : 'text-slate-500'}`}>
                <span className={`h-2 w-2 rounded-full ${fundLookup.status === 'success' ? 'bg-emerald-500' : fundLookup.status === 'error' ? 'bg-rose-500' : fundLookup.status === 'loading' ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                <span>{fundLookup.message}</span>
              </p>
              <p className="text-xs text-slate-500">基金名称：<span className="font-medium text-slate-700">{fundLookup.quote?.name || '待自动解析'}</span></p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fund-sector" className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
              <select 
                id="fund-sector"
                required
                value={fundForm.sector} onChange={(e) => setFundForm({...fundForm, sector: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fund-shares" className="block text-sm font-medium text-slate-700 mb-1">持有份额 (选填)</label>
              <input 
                id="fund-shares" type="number" min="0" step="0.01" value={fundForm.shares} onChange={(e) => setFundForm({...fundForm, shares: e.target.value})}
                placeholder="如已知可直接填写"
                className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className={`text-xs mt-1 ${hasHoldingSharesInput && !isHoldingSharesValid ? 'text-rose-600' : 'text-slate-400'}`}>留空则继续按当前可用净值自动换算份额；如填写则以份额为准。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fund-amount" className="block text-sm font-medium text-slate-700 mb-1">持有金额 / 当前持仓金额 (元)</label>
              <input 
                id="fund-amount" type="number" min="0" step="0.01" required value={fundForm.amount} onChange={(e) => setFundForm({...fundForm, amount: e.target.value})}
                placeholder="当前持仓总金额"
                className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">这里填当前持有金额，已包含累计收益；详情页中的“持有金额”会直接沿用这个展示口径。</p>
            </div>
            <div>
              <label htmlFor="fund-profit" className="block text-sm font-medium text-slate-700 mb-1">持有收益 (元)</label>
              <input 
                id="fund-profit" type="number" step="0.01" required value={fundForm.holdingProfit} onChange={(e) => setFundForm({...fundForm, holdingProfit: e.target.value})}
                placeholder="累计持有收益"
                className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">支持填写负数，系统会据此反推出持仓成本。</p>
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-sm ${isDerivedCostAmountValid ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <div className="font-medium">自动换算结果</div>
            <p className="mt-1">总成本金额 = 持有金额 - 持有收益 = {Number.isFinite(derivedCostAmount) ? `¥${derivedCostAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}</p>
            {!isDerivedCostAmountValid && hasHoldingAmountInput && hasHoldingProfitInput && (
              <p className="mt-1">当前填写会导致成本金额为负数，暂时不能保存。</p>
            )}
            <p className="mt-1 text-xs text-slate-500">保存后会沿用当前自动口径同步逻辑；若未填写份额，系统会继续按当前可用净值自动换算。</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={handleCloseFundModal} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" disabled={!canSubmitFund} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:bg-slate-300 disabled:hover:bg-slate-300 disabled:cursor-not-allowed">保存持仓</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modals.sync} onClose={() => closeModal('sync')} title="同步交易记录" maxWidth="max-w-md">
        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-2 mb-4 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>录入后会按当前自动口径同步份额、持有金额与成本估算，不回算历史日期净值。</p>
        </div>
        <form onSubmit={handleSyncTrade} className="space-y-4">
          <div>
            <label htmlFor="sync-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码/拼音简写</label>
            <input 
              id="sync-code" type="text" required value={syncForm.code} onChange={(e) => setSyncForm({...syncForm, code: e.target.value})}
              placeholder="输入代码选择现有基金" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sync-type" className="block text-sm font-medium text-slate-700 mb-1">交易类型</label>
              <select 
                id="sync-type"
                value={syncForm.type} onChange={(e) => setSyncForm({...syncForm, type: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="买入">买入 / 申购</option>
                  <option value="卖出">卖出 / 赎回</option>
                  <option value="分红">分红</option>
                </select>
              </div>
            <div className="flex items-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              当前按最新可用净值换算份额
            </div>
          </div>
          <div>
            <label htmlFor="sync-amount" className="block text-sm font-medium text-slate-700 mb-1">确认金额 (元)</label>
            <input 
              id="sync-amount" type="number" min="0" step="0.01" required value={syncForm.amount} onChange={(e) => setSyncForm({...syncForm, amount: e.target.value})}
              placeholder="请输入发生金额" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => closeModal('sync')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">确认同步</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modals.import} onClose={() => closeModal('import')} title="导入基金数据">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">点击或拖拽文件到此处</p>
          <p className="text-slate-400 text-sm mt-1">支持 Excel (.xlsx, .xls) 或 CSV 格式</p>
        </div>
        <div className="flex justify-end gap-3 pt-6">
          <button type="button" onClick={() => closeModal('import')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
          <button type="button" className="px-4 py-2 text-white bg-slate-300 rounded-lg font-medium cursor-not-allowed">开始导入</button>
        </div>
      </Modal>

      <Modal isOpen={modals.export} onClose={() => closeModal('export')} title="导出基金数据">
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">选择您要导出的数据内容，系统将生成 Excel 文件供您下载分析。</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="radio" name="exportType" defaultChecked className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-slate-700">当前持仓快照</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
          <button type="button" onClick={() => closeModal('export')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
          <button type="button" onClick={() => closeModal('export')} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"><Download className="w-4 h-4" /> 立即导出</button>
        </div>
      </Modal>

      <Modal isOpen={modals.history} onClose={() => closeModal('history')} title={`${selectedFund?.name || '基金'} - 交易记录`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-slate-500">基金代码: {selectedFund?.code}</span>
            <span className="text-slate-500">当前市值: <span className="font-medium text-slate-800">{formatCurrencyAmount(selectedFund?.amount)}</span></span>
          </div>
          {toNumber(selectedFund?.shares) > 0 && (
            <div className="text-xs text-slate-400 -mt-2">
              当前持有份额：{toNumber(selectedFund?.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份
            </div>
          )}
          
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-3 font-medium">日期</th>
                  <th className="p-3 font-medium">类型</th>
                  <th className="p-3 font-medium text-right">金额(元)</th>
                  <th className="p-3 font-medium text-center">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generateMockHistory().map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{record.date}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        record.type === '买入' ? 'bg-blue-100 text-blue-700' :
                        record.type === '卖出' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      {record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modals.settings} onClose={() => closeModal('settings')} title="编辑持仓信息" maxWidth="max-w-lg">
        <form onSubmit={handleUpdateFund} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700 mb-1">基金名称</label>
            <input 
              id="edit-name" type="text" required value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
              <input 
                id="edit-code" type="text" required value={editForm.code} onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                readOnly 
              />
            </div>
            <div>
              <label htmlFor="edit-sector" className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
              <select 
                id="edit-sector"
                value={editForm.sector} onChange={(e) => setEditForm({...editForm, sector: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-market-value" className="block text-sm font-medium text-slate-700 mb-1">持有金额校准 (元)</label>
            <input 
              id="edit-market-value" type="number" min="0" step="0.01" required value={editForm.amount} onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">如当前持有金额不准，可在此处覆盖，系统会按最新可用净值反推份额。</p>
            {toNumber(editForm.shares) > 0 && (
              <p className="text-xs text-slate-400 mt-1">当前记录份额：{toNumber(editForm.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份</p>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-6">
            <button 
              type="button" 
              onClick={handleDeleteFund}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" /> 删除该持仓
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeModal('settings')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">保存更改</button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}
