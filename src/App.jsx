import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Upload, 
  ArrowRightLeft, 
  TrendingUp,
  Settings,
  FolderPlus,
  Clock,
  LogOut
} from 'lucide-react';
import Sortable from 'sortablejs';
import FormatNumber from './components/common/FormatNumber';
import Modal from './components/common/Modal';
import FundDetailPanel from './components/detail/FundDetailPanel';
import HistoryModal from './components/modals/HistoryModal';
import ImportModal from './components/modals/ImportModal';
import ExportModal from './components/modals/ExportModal';
import GroupModal from './components/modals/GroupModal';
import SyncTradeModal from './components/modals/SyncTradeModal';
import FundTable from './components/FundTable';
import AddFundModal from './components/forms/AddFundModal';
import EditFundModal from './components/forms/EditFundModal';
import {
  buildDetailCacheEntry,
  buildFundDetailModel,
  buildStoredDetailCachePayload,
  DETAIL_CACHE_STORAGE_KEY,
  isDetailCacheStale,
  normalizeStoredDetailCacheStore,
} from './fundDetails';
import {
  buildTradeImpact,
  buildTransactionRecord,
  filterTransactionsByFundCode,
  sortTransactionsByDateDesc,
} from './domain/fundTrade';
import {
  loadTransactions,
  normalizeStoredTransactionStore,
  saveTransactions,
} from './storage/transactionsStorage';
import {
  buildExportBundle,
  buildImportPreview,
  mergeDetailCacheEntries,
  mergeImportedFunds,
  mergeStringArrays,
  mergeTransactionsById,
  validateImportBundle,
} from './domain/importExport';

// --- 初始分组数据 ---
const UNGROUPED_SECTOR = '未分组';
const INITIAL_SECTORS = [];
const DATA_SOURCE_STORAGE_KEY = 'fundTrackerSelectedDataSource';
const DEFAULT_DATA_SOURCE = 'auto';

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

const formatDateTimeLabel = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '--';

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const renderShareDelta = (value) => {
  if (!Number.isFinite(value)) {
    return <span className="text-slate-400">--</span>;
  }

  if (value === 0) {
    return <span className="text-slate-500">0.00 份</span>;
  }

  const colorClass = value > 0 ? 'text-red-500' : 'text-green-500';
  const sign = value > 0 ? '+' : '';

  return (
    <span className={`font-medium ${colorClass}`}>
      {sign}{value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份
    </span>
  );
};

const formatExportFileStamp = (value = new Date()) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  const second = `${value.getSeconds()}`.padStart(2, '0');
  return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
};

// ============================================================================
// 天天基金 / 东财估值服务：JSONP Script 注入法
// ============================================================================
const SCRIPT_TIMEOUT_MS = 8000;

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundAmount = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return v;
  const num = Number.parseFloat(v);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : num;
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
  const normalizedSector = typeof fund.sector === 'string' ? fund.sector.trim() : '';

  return {
    id: fund.id ?? Date.now() + index,
    name: typeof fund.name === 'string' && fund.name.trim() ? fund.name.trim() : '未命名基金',
    code: String(fund.code || '').trim(),
    sector: normalizedSector || UNGROUPED_SECTOR,
    amount: Math.max(0, roundAmount(toNumber(fund.amount))),
    dailyRate: toNumber(fund.dailyRate),
    dailyProfit: roundAmount(toNumber(fund.dailyProfit)),
    totalProfit: roundAmount(toNumber(fund.totalProfit)),
    totalRate: toNumber(fund.totalRate),
    weeklyProfit: roundAmount(toNumber(fund.weeklyProfit)),
    monthlyProfit: roundAmount(toNumber(fund.monthlyProfit)),
    shares: hasTrackedShares ? Math.max(0, toNumber(fund.shares)) : undefined,
    costAmount: fund.costAmount !== undefined ? Math.max(0, roundAmount(toNumber(fund.costAmount))) : undefined,
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

const createEmptyFundForm = (defaultSector = '') => ({
  code: '',
  sector: defaultSector,
  amount: '',
  holdingProfit: '',
  shares: '',
  entryMode: 'newBuy',
  confirmTime: 'before15',
  weeklyProfit: '',
  monthlyProfit: '',
});

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
  let lastNetValue = toNumber(overrides.lastNetValue ?? fund.lastNetValue);
  let dailyRateOverride = overrides.dailyRate;

  // 结算日期判定：若数据日期严格小于记账起算成交日，强制今日前置收益及涨幅为 0
  const netValueDate = overrides.netValueDate ?? fund.netValueDate;
  const holdingStartDate = overrides.holdingStartDate ?? fund.holdingStartDate;
  if (holdingStartDate && netValueDate && netValueDate < holdingStartDate) {
    lastNetValue = currentNetValue;
    dailyRateOverride = 0;
  }

  const derivedDailyRate = currentNetValue > 0 && lastNetValue > 0
    ? ((currentNetValue - lastNetValue) / lastNetValue) * 100
    : 0;
  const dailyRate = toNumber(dailyRateOverride ?? derivedDailyRate);
  const fallbackMarketValue = Math.max(0, toNumber(overrides.amount ?? fund.amount));
  const marketValue = hasTrackedShares
    ? (shares > 0 ? (currentNetValue > 0 ? shares * currentNetValue : (lastNetValue > 0 ? shares * lastNetValue : fallbackMarketValue)) : 0)
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
    amount: roundAmount(marketValue),
    shares: hasTrackedShares ? shares : undefined,
    costAmount: costAmount !== undefined ? roundAmount(costAmount) : undefined,
    currentNetValue,
    lastNetValue,
    dailyRate,
    dailyProfit: roundAmount(dailyProfit),
    totalProfit: roundAmount(totalProfit),
    totalRate,
    weeklyProfit: roundAmount(toNumber(overrides.weeklyProfit ?? fund.weeklyProfit)),
    monthlyProfit: roundAmount(toNumber(overrides.monthlyProfit ?? fund.monthlyProfit)),
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
  let lastNetValue = fund.officialLastNetValue !== undefined ? Math.max(0, toNumber(fund.officialLastNetValue)) : undefined;
  let storedOfficialDailyRate = fund.officialDailyRate !== undefined ? toNumber(fund.officialDailyRate) : undefined;

  // 结算日期判定：若数据日期严格小于记账起算成交日，强制前置官方收益及涨幅为 0
  const officialNetValueDate = fund.officialNetValueDate || fund.netValueDate;
  const holdingStartDate = fund.holdingStartDate;
  if (holdingStartDate && officialNetValueDate && officialNetValueDate < holdingStartDate) {
    if (currentNetValue !== undefined) {
      lastNetValue = currentNetValue;
    }
    storedOfficialDailyRate = 0;
  }
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
    amount: amount !== null ? roundAmount(amount) : null,
    dailyRate,
    dailyProfit: dailyProfit !== null ? roundAmount(dailyProfit) : null,
    totalProfit: totalProfit !== null ? roundAmount(totalProfit) : null,
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

const buildDisplayedFund = (fund, preferredDataSource = DEFAULT_DATA_SOURCE) => {
  const quoteSource = inferStoredQuoteSource(fund);

  if (preferredDataSource === 'eastmoney') {
    if (hasUsableOfficialSnapshot(fund)) {
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
  }

  if (preferredDataSource === 'auto' && shouldPreferOfficialValuation({ ...fund, quoteSource })) {
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
  const currentNetValue = toNumber(fund?.currentNetValue);
  const lastNetValue = toNumber(fund?.lastNetValue);
  const refNetValue = currentNetValue > 0 ? currentNetValue : (lastNetValue > 0 ? lastNetValue : 0);
  const sanitizedAmount = Math.max(0, toNumber(amount));

  if (refNetValue <= 0) {
    return null;
  }

  return sanitizedAmount > 0 ? sanitizedAmount / refNetValue : 0;
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

const addOneDay = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadTiantianFundQuote = (fundCode) => {
  return new Promise((resolve, reject) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    // 精准识别场内上市交易型 ETF (上交所 51/56/58 开头，深交所 159 开头) -> 使用腾讯高频 Tick 行情 API
    // 避开 501、502、16 等 LOF 基金及退市分级基金，使其按普通场外基金在天天基金抓取以保证净值计算的准确性
    const isListedETF = /^(?:51\d{4}|56\d{4}|58\d{4}|159\d{3})$/.test(normalizedCode);

    if (isListedETF) {
      const marketPrefix = normalizedCode.startsWith('5') ? 'sh' : 'sz';
      const scriptId = `etf_quote_${normalizedCode}_${Date.now()}`;
      let settled = false;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        document.getElementById(scriptId)?.remove();
      };

      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`场内基金 ${normalizedCode} 行情请求超时`));
      }, SCRIPT_TIMEOUT_MS);

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://qt.gtimg.cn/q=s_${marketPrefix}${normalizedCode}&rt=${Date.now()}`;
      script.async = true;
      script.onload = () => {
        if (settled) return;
        settled = true;

        try {
          const varName = `v_s_${marketPrefix}${normalizedCode}`;
          const rawData = window[varName];
          if (!rawData) {
            cleanup();
            reject(new Error(`场内基金 ${normalizedCode} 行情解析失败：变量不存在`));
            return;
          }

          const parts = rawData.split('~');
          const name = parts[1] || '';
          const lastPrice = toNumber(parts[3]);
          const changePercent = toNumber(parts[5]); // 涨跌幅百分比

          cleanup();
          resolve({
            code: normalizedCode,
            name: name,
            // 昨收价可根据现价与涨跌幅精确反算
            lastNetValue: lastPrice / (1 + changePercent / 100),
            estimatedNetValue: lastPrice,
            dailyRate: changePercent,
            updateTime: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            netValueDate: new Date().toLocaleDateString('zh-CN').replace(/\//g, '-'),
            quoteSource: 'estimate',
          });
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`场内基金 ${normalizedCode} 行情加载失败`));
      };

      document.body.appendChild(script);
      return;
    }

    // 场外普通公募基金：采用东方财富官网主域名 (防拦截) + 备用降级双域名 fallback
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

    const loadFallback = () => {
      if (settled) return;

      const fallbackScript = document.createElement('script');
      fallbackScript.id = scriptId;
      fallbackScript.src = `https://fundgz.1234567.com.cn/js/${normalizedCode}.js?rt=${Date.now()}`;
      fallbackScript.async = true;

      fallbackScript.onload = () => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`基金 ${normalizedCode} 备用估值加载成功但未返回数据`));
        }
      };

      fallbackScript.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`基金 ${normalizedCode} 估值双域名加载均失败`));
      };

      document.getElementById(scriptId)?.remove();
      document.body.appendChild(fallbackScript);
    };

    const script = document.createElement('script');
    script.id = scriptId;
    // 优先加载东方财富主域名
    script.src = `https://fundgz.eastmoney.com/js/${normalizedCode}.js?rt=${Date.now()}`;
    script.async = true;

    script.onload = () => {
      if (!settled) {
        // 脚本加载完成但未触发回调，很可能是返回了 HTML，立即切换至备用降级域名
        loadFallback();
      }
    };

    script.onerror = () => {
      if (!settled) {
        loadFallback();
      }
    };

    document.body.appendChild(script);
  });
};

const enqueueTiantianFundQuote = (fundCode) => {
  const task = tiantianQuoteQueue.then(() => loadTiantianFundQuote(fundCode));
  tiantianQuoteQueue = task.then(() => undefined, () => undefined);
  return task;
};

const loadFundNameFromPingzhongData = (fundCode) => {
  return new Promise((resolve, reject) => {
    const normalizedCode = String(fundCode || '').trim();
    if (!normalizedCode) {
      reject(new Error('基金代码不能为空'));
      return;
    }

    const scriptId = `pingzhongdata_${normalizedCode}_${Date.now()}`;
    let settled = false;

    // 缓存先前的全局变量以保证安全性
    const prevName = window.fS_name;
    const prevCode = window.fS_code;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();
      window.fS_name = prevName;
      window.fS_code = prevCode;
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 基本信息请求超时`));
    }, SCRIPT_TIMEOUT_MS);

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?rt=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (settled) return;
      settled = true;
      const name = window.fS_name;
      cleanup();
      if (name) {
        resolve(name);
      } else {
        reject(new Error(`未找到基金 ${normalizedCode} 的基本面信息`));
      }
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`基金 ${normalizedCode} 基本信息加载失败`));
    };

    document.body.appendChild(script);
  });
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

const loadPingzhongData = (fundCode) => {
  return new Promise((resolve) => {
    const normalizedCode = String(fundCode || '').trim();
    const scriptId = `pingzhong_data_${normalizedCode}_${Date.now()}`;
    let settled = false;

    const originalStockCodes = window.stockCodesNew;
    const originalStockNames = window.stockNames;
    const originalStockPercent = window.stockPercent;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null); // 超时也原谅，不阻塞主详情
    }, 4000);

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?rt=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (settled) return;
      settled = true;

      try {
        const stockCodes = window.stockCodesNew || [];
        const stockNames = window.stockNames || [];
        const stockPercent = window.stockPercent || [];

        window.stockCodesNew = originalStockCodes;
        window.stockNames = originalStockNames;
        window.stockPercent = originalStockPercent;

        cleanup();
        resolve({ stockCodes, stockNames, stockPercent });
      } catch (err) {
        cleanup();
        resolve(null);
      }
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    };

    document.body.appendChild(script);
  });
};

const fetchFundDetailRemoteData = async (fundCode) => {
  const normalizedCode = String(fundCode || '').trim();
  const [quoteResult, historyResult, holdingsResult] = await Promise.allSettled([
    enqueueTiantianFundQuote(normalizedCode),
    enqueueEastmoneyOfficialHistoryRange(normalizedCode),
    loadPingzhongData(normalizedCode),
  ]);

  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const officialHistory = historyResult.status === 'fulfilled' ? historyResult.value.history : [];
  const holdingsData = holdingsResult.status === 'fulfilled' ? holdingsResult.value : null;

  if (!quote && officialHistory.length === 0) {
    const quoteError = quoteResult.status === 'rejected' ? quoteResult.reason?.message : '';
    const historyError = historyResult.status === 'rejected' ? historyResult.reason?.message : '';
    throw new Error(historyError || quoteError || '基金详情获取失败');
  }

  const holdings = [];
  if (holdingsData && Array.isArray(holdingsData.stockCodes)) {
    const len = holdingsData.stockCodes.length;
    for (let i = 0; i < len; i++) {
      if (holdingsData.stockCodes[i]) {
        holdings.push({
          code: holdingsData.stockCodes[i],
          name: holdingsData.stockNames[i] || '',
          percent: toNumber(holdingsData.stockPercent[i]),
        });
      }
    }
  }

  return buildDetailCacheEntry({
    code: normalizedCode,
    quote,
    officialHistory,
    remoteThemes: [],
    holdings,
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

const alignFundSharesAndCost = async (fund, nextShares, nextCostAmount, fallbackName = fund.name) => {
  const sanitizedShares = Math.max(0, toNumber(nextShares));
  const sanitizedCost = Math.max(0, toNumber(nextCostAmount));

  try {
    const quote = await enqueueTiantianFundQuote(fund.code);
    const quoteAlignedFund = reconcileFundWithQuote({ ...fund, name: fallbackName }, quote);
    return buildFundSnapshot(quoteAlignedFund, {
      name: quote.name || fallbackName,
      shares: sanitizedShares,
      costAmount: sanitizedCost,
    });
  } catch (error) {
    console.warn(`持仓份额及成本校准失败: ${fund.code}`, error);
  }

  return buildFundSnapshot({ ...fund, name: fallbackName }, {
    name: fallbackName,
    shares: sanitizedShares,
    costAmount: sanitizedCost,
  });
};

const applyTradeToFund = (fund, trade, quote, tradeDate) => {
  const normalizedFund = quote ? reconcileFundWithQuote(fund, quote) : { ...fund, quoteSource: inferStoredQuoteSource(fund) };
  const referenceNetValue = getDisplayedReferenceNetValue(normalizedFund);
  const currentShares = Math.max(0, toNumber(normalizedFund.shares) || deriveSharesFromDisplayedAmount(normalizedFund) || 0);
  const tradeImpact = buildTradeImpact({
    fund: normalizedFund,
    trade,
    referenceNetValue,
    currentShares,
    currentCostAmount: Math.max(0, toNumber(normalizedFund.costAmount)),
    tradeDate,
  });

  if (!tradeImpact) {
    return normalizedFund;
  }

  return buildFundSnapshot(normalizedFund, {
    name: quote?.name || normalizedFund.name,
    shares: tradeImpact.nextShares,
    costAmount: tradeImpact.nextCostAmount,
    holdingStartDate: tradeImpact.nextHoldingStartDate,
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

  return buildFundSnapshot(fund, {
    shares: derivedShares,
    bootstrapSharesFromAmount: false,
  });
};
// ============================================================================

export default function FundTrackerApp() {
  
  // Auth Guard
  useEffect(() => {
    // Skip auth guard during local dev on port 5173
    if (window.location.port === '5173') {
      return;
    }
    fetch('/api/auth/me?_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => {
        if (res.status === 401) {
          window.location.href = '/login.html';
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    // If running in local Vite development mode, bypass backend call and redirect
    if (window.location.port === '5173') {
      window.location.href = '/login.html';
      return;
    }
    try {
      const res = await fetch('/api/auth/me', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login.html';
      } else {
        alert('退出登录失败，请重试');
      }
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login.html';
    }
  };

  // 1. 初始化持仓：从 localStorage 读取，若无则默认为空数组 []
  const [funds, setFunds] = useState(() => {
    return normalizeStoredFunds(readStoredJson('fundTrackerData', []));
  });
  const [detailCacheEntries, setDetailCacheEntries] = useState(() => {
    return normalizeStoredDetailCacheStore(readStoredJson(DETAIL_CACHE_STORAGE_KEY, {})).entries;
  });
  const [transactions, setTransactions] = useState(() => loadTransactions());

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

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

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
  const [selectedDataSource, setSelectedDataSource] = useState(() => {
    const stored = readStoredJson(DATA_SOURCE_STORAGE_KEY, DEFAULT_DATA_SOURCE);
    return stored === 'eastmoney' || stored === 'auto' || stored === 'tiantian'
      ? stored
      : DEFAULT_DATA_SOURCE;
  });
  const hasAutoRefreshedRef = useRef(false);
  const fundLookupRequestRef = useRef(0);
  const groupTableRef = useRef(null);
  const importFileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(DATA_SOURCE_STORAGE_KEY, JSON.stringify(selectedDataSource));
  }, [selectedDataSource]);

  const [modals, setModals] = useState({
    group: false, fund: false, sync: false, import: false, export: false, history: false, settings: false
  });

  const openModal = (type) => setModals(prev => ({ ...prev, [type]: true }));
  const closeModal = (type) => setModals(prev => ({ ...prev, [type]: false }));

  const [groupForm, setGroupForm] = useState({ mode: 'create', originalName: '', name: '' });
  const [fundForm, setFundForm] = useState(() => createEmptyFundForm(UNGROUPED_SECTOR));
  const [fundLookup, setFundLookup] = useState(createEmptyFundLookup);
  const [syncForm, setSyncForm] = useState(() => ({
    code: '',
    type: '买入',
    fee: '',
    tradeDate: getTodayDateKey(),
    confirmTime: 'before15',
    amount: '',
  }));
  const [editForm, setEditForm] = useState({ id: null, name: '', code: '', sector: '', amount: '', weeklyProfit: '', monthlyProfit: '' });
  const [importState, setImportState] = useState({
    fileName: '',
    error: '',
    preview: null,
    payload: null,
    mode: 'replace-all',
    isParsing: false,
  });

  const entryMode = fundForm.entryMode || 'newBuy';
  const normalizedFundCode = String(fundForm.code || '').trim();
  const normalizedFundSector = String(fundForm.sector || '').trim();
  
  const holdingAmountValue = String(fundForm.amount || '').trim() !== '' ? Number.parseFloat(fundForm.amount) : Number.NaN;
  const holdingProfitValue = entryMode === 'newBuy' ? 0 : (String(fundForm.holdingProfit || '').trim() !== '' ? Number.parseFloat(fundForm.holdingProfit) : Number.NaN);
  
  const derivedCostAmountRaw = entryMode === 'newBuy' ? holdingAmountValue : (Number.isFinite(holdingAmountValue) && Number.isFinite(holdingProfitValue) ? holdingAmountValue - holdingProfitValue : Number.NaN);
  const derivedCostAmount = Number.isFinite(derivedCostAmountRaw) ? Math.max(0, derivedCostAmountRaw) : Number.NaN;
  
  const isHoldingAmountValid = Number.isFinite(holdingAmountValue) && holdingAmountValue > 0;
  const isHoldingProfitValid = entryMode === 'newBuy' || Number.isFinite(holdingProfitValue);
  const isDerivedCostAmountValid = entryMode === 'newBuy' ? isHoldingAmountValid : (Number.isFinite(derivedCostAmountRaw) && derivedCostAmountRaw >= 0);
  const isFundSectorValid = Boolean(normalizedFundSector) && sectors.includes(normalizedFundSector);
  
  const canSubmitFund = fundLookup.status === 'success' && isHoldingAmountValid && isHoldingProfitValid && isDerivedCostAmountValid && isFundSectorValid;

  const resetFundModalState = useCallback(() => {
    const defaultSector = sectors.includes(UNGROUPED_SECTOR) ? UNGROUPED_SECTOR : (sectors[0] || UNGROUPED_SECTOR);
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

  const resetImportState = useCallback(() => {
    setImportState({
      fileName: '',
      error: '',
      preview: null,
      payload: null,
      mode: 'replace-all',
      isParsing: false,
    });

    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  }, []);

  const handleOpenImportModal = () => {
    resetImportState();
    openModal('import');
  };

  const handleCloseImportModal = () => {
    resetImportState();
    closeModal('import');
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
      ...buildDisplayedFund(fund, selectedDataSource),
      sourceFund: fund,
    }));
  }, [funds, selectedDataSource]);

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

  const valuationSourceHint = selectedDataSource === 'tiantian'
    ? '当前列表口径：天天基金'
    : selectedDataSource === 'eastmoney'
      ? '当前列表口径：东财官方净值'
      : [
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
  const { groupedFunds, totalDailyProfit, totalAmount, totalProfit, hasIncompleteDaily, hasIncompleteAmount, hasIncompleteProfit } = useMemo(() => {
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
      const targetSector = groups[fund.sector] ? fund.sector : UNGROUPED_SECTOR;
      
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

    Object.keys(groups).forEach((key) => {
      groups[key].sectorDailyProfit = roundAmount(groups[key].sectorDailyProfit);
      groups[key].sectorAmount = roundAmount(groups[key].sectorAmount);
      groups[key].sectorTotalProfit = roundAmount(groups[key].sectorTotalProfit);
    });

    const anyDailyAvailable = displayedFunds.some(f => Number.isFinite(f.dailyProfit));
    const anyAmountAvailable = displayedFunds.some(f => Number.isFinite(f.amount));
    const anyProfitAvailable = displayedFunds.some(f => Number.isFinite(f.totalProfit));

    return {
      groupedFunds: groups,
      totalDailyProfit: anyDailyAvailable ? roundAmount(tDaily) : null,
      totalAmount: anyAmountAvailable ? roundAmount(tAmount) : null,
      totalProfit: anyProfitAvailable ? roundAmount(tProfit) : null,
      hasIncompleteDaily,
      hasIncompleteAmount,
      hasIncompleteProfit,
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
    const customGroups = sectors
      .filter((sector) => sector !== UNGROUPED_SECTOR)
      .map((sector) => ({
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

    const ungroupedData = groupedFunds[UNGROUPED_SECTOR];
    if (ungroupedData && ungroupedData.funds.length > 0) {
      customGroups.push({
        sector: UNGROUPED_SECTOR,
        data: ungroupedData,
      });
    }

    return customGroups;
  }, [groupedFunds, sectors]);

  const selectedFundTransactions = useMemo(() => {
    if (!selectedFund?.code) {
      return [];
    }

    return sortTransactionsByDateDesc(filterTransactionsByFundCode(transactions, selectedFund.code));
  }, [selectedFund?.code, transactions]);

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

    const normalizedName = String(groupForm.name || '').trim();
    if (!normalizedName) return;

    if (groupForm.mode === 'edit') {
      const originalName = String(groupForm.originalName || '').trim();
      if (!originalName || originalName === UNGROUPED_SECTOR) return;
      if (normalizedName !== originalName && sectors.includes(normalizedName)) {
        alert('已存在同名分组，请换一个名称。');
        return;
      }

      setSectors((current) => current.map((sector) => (sector === originalName ? normalizedName : sector)));
      setFunds((current) => current.map((fund) => (
        fund.sector === originalName
          ? { ...fund, sector: normalizedName }
          : fund
      )));
    } else if (!sectors.includes(normalizedName)) {
      setSectors((current) => [...current, normalizedName]);
    }

    setGroupForm({ mode: 'create', originalName: '', name: '' });
    closeModal('group');
  };

  const handleOpenCreateGroup = () => {
    setGroupForm({ mode: 'create', originalName: '', name: '' });
    openModal('group');
  };

  const handleOpenEditGroup = (sector) => {
    if (sector === UNGROUPED_SECTOR) {
      return;
    }

    setGroupForm({ mode: 'edit', originalName: sector, name: sector });
    openModal('group');
  };

  const handleCloseGroupModal = () => {
    setGroupForm({ mode: 'create', originalName: '', name: '' });
    closeModal('group');
  };

  const handleDeleteGroup = (sector) => {
    if (!sector || sector === UNGROUPED_SECTOR) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除分组“${sector}”吗？该分组下的基金将移动到“${UNGROUPED_SECTOR}”。`);
    if (!shouldDelete) {
      return;
    }

    setSectors((current) => {
      const next = current.filter((item) => item !== sector);
      return next.includes(UNGROUPED_SECTOR) ? next : [UNGROUPED_SECTOR, ...next];
    });
    setFunds((current) => current.map((fund) => (
      fund.sector === sector
        ? { ...fund, sector: UNGROUPED_SECTOR }
        : fund
    )));
    setCollapsedGroups((current) => {
      const next = new Set(current);
      next.delete(sector);
      return next;
    });
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

        // 尝试启动双重兜底方案：从官方历史接口 + 东方财富基金基本面（PingzhongData）接口重组行情
        try {
          const [officialHistory, fundName] = await Promise.all([
            loadEastmoneyOfficialHistory(normalizedFundCode),
            loadFundNameFromPingzhongData(normalizedFundCode).catch(() => '')
          ]);

          if (fundLookupRequestRef.current !== requestId) {
            return;
          }

          if (officialHistory && officialHistory.currentNetValue > 0) {
            const quote = {
              code: normalizedFundCode,
              name: fundName || ('公募基金 ' + normalizedFundCode),
              lastNetValue: officialHistory.currentNetValue,
              estimatedNetValue: 0,
              dailyRate: officialHistory.dailyRate || 0,
              updateTime: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
              netValueDate: officialHistory.netValueDate || '',
              quoteSource: 'quote',
            };

            setFundLookup({
              status: 'success',
              message: `基金名称已通过基本面匹配：${quote.name}`,
              quote,
            });
            return;
          }
        } catch (fallbackErr) {
          console.warn('多源兜底获取也失败：', fallbackErr);
        }

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
      alert('请先确认基金代码查询成功，并检查分组、持仓金额与持有收益填写是否有效。');
      return;
    }

    const hasDuplicateFund = funds.some((fund) => String(fund.code || '').trim() === normalizedFundCode);
    if (hasDuplicateFund) {
      alert('这只基金已经在持仓列表里了。请用“同步交易”调整仓位，或到“设置”里修改现有持仓。');
      return;
    }

    const entryMode = fundForm.entryMode || 'newBuy';
    const confirmTime = fundForm.confirmTime || 'before15';
    const includeDailyProfit = fundForm.includeDailyProfit || 'yes';

    const lastNetValueVal = fundLookup.quote?.lastNetValue || 0;
    const estimatedNetValueVal = fundLookup.quote?.estimatedNetValue || 0;
    const refNetValueVal = estimatedNetValueVal > 0 ? estimatedNetValueVal : (lastNetValueVal > 0 ? lastNetValueVal : 0);

    let shares = 0;
    let costAmount = 0;
    let baseAmount = holdingAmountValue;
    let initialLastNetValue = lastNetValueVal;
    let initialCurrentNetValue = refNetValueVal;
    let holdingStartDate = getTodayDateKey();

    if (entryMode === 'newBuy') {
      shares = refNetValueVal > 0 ? holdingAmountValue / refNetValueVal : 0;
      costAmount = holdingAmountValue;
      baseAmount = holdingAmountValue;
      initialLastNetValue = refNetValueVal; // 今天无收益

      if (confirmTime === 'after15') {
        holdingStartDate = addOneDay(addOneDay(getTodayDateKey())); // 15点后提交，后天起算收益
      } else {
        holdingStartDate = addOneDay(getTodayDateKey()); // 15点前提交，明天起算收益
      }
    } else {
      holdingStartDate = ''; // 已持有基金无需结算期限制，今日收益正常展示
      if (includeDailyProfit === 'yes') {
        shares = refNetValueVal > 0 ? holdingAmountValue / refNetValueVal : 0;
        costAmount = Math.max(0, holdingAmountValue - holdingProfitValue);
      } else {
        const buyNetValue = lastNetValueVal > 0 ? lastNetValueVal : refNetValueVal;
        shares = buyNetValue > 0 ? holdingAmountValue / buyNetValue : 0;
        costAmount = Math.max(0, holdingAmountValue - holdingProfitValue);
        const todayProfit = refNetValueVal > 0 && buyNetValue > 0 ? shares * (refNetValueVal - buyNetValue) : 0;
        baseAmount = holdingAmountValue + todayProfit;
      }
    }

    costAmount = roundAmount(costAmount);
    baseAmount = roundAmount(baseAmount);

    const baseFund = {
      id: Date.now(),
      name: String(fundLookup.quote.name || '').trim() || '未命名基金',
      code: normalizedFundCode,
      sector: normalizedFundSector,
      shares: shares,
      costAmount: costAmount,
      amount: baseAmount,
      currentNetValue: initialCurrentNetValue,
      lastNetValue: initialLastNetValue,
      lastValuationTime: fundLookup.quote.updateTime || '',
      netValueDate: fundLookup.quote.netValueDate || '',
      bootstrapSharesFromAmount: false,
      quoteSource: getQuoteSourceFromQuote(fundLookup.quote),
      dailyRate: fundLookup.quote.dailyRate || 0,
      weeklyProfit: roundAmount(toNumber(fundForm.weeklyProfit)),
      monthlyProfit: roundAmount(toNumber(fundForm.monthlyProfit)),
      holdingStartDate: holdingStartDate,
    };

    let newFund = buildFundSnapshot(baseFund);

    try {
      const officialSnapshot = await enqueueEastmoneyOfficialHistory(normalizedFundCode);
      newFund = applyOfficialNetValueToFund(newFund, officialSnapshot);

      if (entryMode === 'newBuy') {
        if (newFund.officialCurrentNetValue !== undefined) {
          newFund.officialLastNetValue = newFund.officialCurrentNetValue;
        }
      } else if (entryMode === 'existing' && includeDailyProfit === 'yes') {
        // 已包含今日收益：用官方今日收盘净值重新折算份额，确保 shares * officialNAV === 用户输入金额
        const offCurrent = toNumber(newFund.officialCurrentNetValue);
        if (offCurrent > 0) {
          newFund.shares = holdingAmountValue / offCurrent;
        }
      } else if (entryMode === 'existing' && includeDailyProfit === 'no') {
        // 未包含今日收益：用官方昨日收盘净值重新折算份额
        const offLast = newFund.officialLastNetValue || newFund.officialCurrentNetValue || 0;
        if (offLast > 0) {
          newFund.shares = holdingAmountValue / offLast;
        }
      }
    } catch (error) {
      console.warn(`新增持仓时获取官方净值失败: ${normalizedFundCode}`, error);
    }

    if (shouldPreferOfficialValuation(newFund)) {
      newFund = {
        ...newFund,
        ...buildOfficialValuationFund(newFund)
      };
    } else {
      newFund = buildFundSnapshot(newFund);
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
    const lastNetValue = toNumber(tradeReferenceFund.lastNetValue);
    const referenceNetValue = lastNetValue > 0 ? lastNetValue : getDisplayedReferenceNetValue(tradeReferenceFund);

    if (referenceNetValue <= 0) {
      alert('暂时无法获取这只基金的可用净值，无法按份额口径同步交易，请先刷新数据后再试。');
      return;
    }

    const confirmTime = syncForm.confirmTime || 'before15';
    const baseTradeDate = syncForm.tradeDate || getTodayDateKey();
    const finalTradeDate = confirmTime === 'before15' ? baseTradeDate : addOneDay(baseTradeDate);

    const tradePayload = {
      type: syncForm.type || '买入',
      volumeType: 'amount',
      amount: syncForm.amount,
      fee: syncForm.fee || 0,
    };

    const currentShares = Math.max(0, toNumber(tradeReferenceFund.shares) || deriveSharesFromDisplayedAmount(tradeReferenceFund) || 0);
    const tradeImpact = buildTradeImpact({
      fund: tradeReferenceFund,
      trade: tradePayload,
      referenceNetValue,
      currentShares,
      currentCostAmount: Math.max(0, toNumber(tradeReferenceFund.costAmount)),
      tradeDate: finalTradeDate,
    });

    if (!tradeImpact) {
      alert('当前交易信息无效，暂时无法完成同步，请检查金额后重试。');
      return;
    }

    const transactionRecord = buildTransactionRecord({
      fund: tradeReferenceFund,
      tradeImpact,
    });

    setFunds((currentFunds) => currentFunds.map((fund) => {
      if (fund.id !== targetFund.id) {
        return fund;
      }

      return applyTradeToFund(fund, tradePayload, quote, finalTradeDate);
    }));

    if (transactionRecord) {
      setTransactions((currentTransactions) => sortTransactionsByDateDesc([...currentTransactions, transactionRecord]));
    }

    closeModal('sync');
    setSyncForm({
      code: '',
      type: '买入',
      fee: '',
      tradeDate: getTodayDateKey(),
      confirmTime: 'before15',
      amount: '',
    });
  };

  const handleOpenHistory = (fund) => {
    setSelectedFund(fund);
    openModal('history');
  };

  const handleCloseHistory = () => {
    setSelectedFund(null);
    closeModal('history');
  };

  const handleExportData = () => {
    const exportBundle = buildExportBundle({
      funds,
      sectors,
      detailCache: buildStoredDetailCachePayload(detailCacheEntries),
      transactions,
    });

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json;charset=utf-8' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `fund-tracker-export-${formatExportFileStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    closeModal('export');
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportState((current) => ({
      ...current,
      fileName: file.name,
      error: '',
      preview: null,
      payload: null,
      isParsing: true,
    }));

    try {
      const fileText = await file.text();
      const parsedPayload = JSON.parse(fileText);
      const validationResult = validateImportBundle(parsedPayload);

      if (!validationResult.ok) {
        setImportState((current) => ({
          ...current,
          error: validationResult.error,
          preview: null,
          payload: null,
          isParsing: false,
        }));
        return;
      }

      const normalizedFunds = normalizeStoredFunds(parsedPayload.data.funds);
      const normalizedSectors = normalizeStoredSectors(parsedPayload.data.sectors);
      const normalizedDetailCacheEntries = normalizeStoredDetailCacheStore(parsedPayload.data.detailCache ?? {}).entries;
      const normalizedTransactions = normalizeStoredTransactionStore(parsedPayload.data.transactions ?? []).entries;

      const hasImportData = normalizedFunds.length > 0
        || normalizedSectors.length > 0
        || normalizedTransactions.length > 0
        || Object.keys(normalizedDetailCacheEntries).length > 0;

      if (!hasImportData) {
        setImportState((current) => ({
          ...current,
          error: '导入文件中没有可用数据。',
          preview: null,
          payload: null,
          isParsing: false,
        }));
        return;
      }

      const preview = {
        ...buildImportPreview(parsedPayload),
        fundsCount: normalizedFunds.length,
        sectorsCount: normalizedSectors.length,
        transactionsCount: normalizedTransactions.length,
        detailCacheCount: Object.keys(normalizedDetailCacheEntries).length,
      };

      setImportState((current) => ({
        ...current,
        error: '',
        preview,
        payload: {
          funds: normalizedFunds,
          sectors: normalizedSectors,
          detailCacheEntries: normalizedDetailCacheEntries,
          transactions: normalizedTransactions,
        },
        isParsing: false,
      }));
    } catch (error) {
      setImportState((current) => ({
        ...current,
        error: error instanceof SyntaxError ? '文件内容不是有效的 JSON，请检查后重试。' : (error?.message || '导入文件解析失败。'),
        preview: null,
        payload: null,
        isParsing: false,
      }));
    }
  };

  const handleConfirmImport = () => {
    if (!importState.payload) {
      return;
    }

    if (importState.mode === 'replace-all') {
      setFunds(importState.payload.funds);
      setSectors(importState.payload.sectors);
      setDetailCacheEntries(importState.payload.detailCacheEntries);
      setTransactions(sortTransactionsByDateDesc(importState.payload.transactions));
    } else {
      setFunds((currentFunds) => mergeImportedFunds(currentFunds, importState.payload.funds));
      setSectors((currentSectors) => mergeStringArrays(currentSectors, importState.payload.sectors));
      setDetailCacheEntries((currentEntries) => mergeDetailCacheEntries(currentEntries, importState.payload.detailCacheEntries));
      setTransactions((currentTransactions) => sortTransactionsByDateDesc(mergeTransactionsById(currentTransactions, importState.payload.transactions)));
    }

    setSelectedFund(null);
    setDetailView({ isOpen: false, code: '' });
    handleCloseImportModal();
    alert(importState.mode === 'replace-all' ? '导入成功，当前数据已完成替换。' : '导入成功，已按追加模式合并数据。');
  };

  const handleOpenSettings = (fund) => {
    const sourceFund = fund.sourceFund ?? fund;
    const currentAmount = Number.isFinite(fund.amount) ? fund.amount : sourceFund.amount;
    const currentCostAmount = Number.isFinite(sourceFund.costAmount) ? sourceFund.costAmount : currentAmount;
    const holdingProfit = currentAmount - currentCostAmount;
    
    setEditForm({
      ...sourceFund,
      amount: currentAmount,
      holdingProfit: holdingProfit,
      weeklyProfit: sourceFund.weeklyProfit ?? '',
      monthlyProfit: sourceFund.monthlyProfit ?? '',
    });
    openModal('settings');
  };

  const handleUpdateFund = async (e) => {
    e.preventDefault();

    const nextAmount = roundAmount(toNumber(editForm.amount));
    const nextHoldingProfit = roundAmount(toNumber(editForm.holdingProfit));
    const nextCostAmount = roundAmount(Math.max(0, nextAmount - nextHoldingProfit));

    const currentNetValue = toNumber(editForm.currentNetValue);
    const lastNetValue = toNumber(editForm.lastNetValue);
    const refNetValue = currentNetValue > 0 ? currentNetValue : (lastNetValue > 0 ? lastNetValue : 0);
    const nextShares = refNetValue > 0 ? nextAmount / refNetValue : (toNumber(editForm.shares) || 0);

    const nextFunds = await Promise.all(funds.map(async (fund) => {
      if (fund.id !== editForm.id) {
        return fund;
      }

      const updatedFund = await alignFundSharesAndCost({
        ...fund,
        name: editForm.name,
        code: editForm.code,
        sector: editForm.sector,
      }, nextShares, nextCostAmount, editForm.name);

      return {
        ...updatedFund,
        amount: nextAmount,
        sector: editForm.sector,
        weeklyProfit: roundAmount(toNumber(editForm.weeklyProfit)),
        monthlyProfit: roundAmount(toNumber(editForm.monthlyProfit)),
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
        <header className="flex-shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl shadow-xl border border-slate-700/40 text-white relative overflow-hidden">
          {/* Subtle micro-lighting effect */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>
          <div className="absolute bottom-0 left-20 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
              <TrendingUp className="text-emerald-400 w-8 h-8 filter drop-shadow-[0_2px_8px_rgba(52,211,153,0.3)] animate-pulse" />
              <span>智能基金追踪</span> 
              <span className="text-xs font-bold text-slate-300 ml-2 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">PRO V1.5.0</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <p className="text-slate-400 text-sm">全天候精准追踪您的基金组合与盘中实时估值</p>
              {updateBadgeText && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 backdrop-blur-md">
                  <Clock className="w-3.5 h-3.5 animate-spin-slow" /> {updateBadgeText}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-8 lg:gap-10 mt-6 lg:mt-0 relative z-10 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs mb-1 font-medium tracking-wide uppercase">总资产金额 (元)</span>
              <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                {formatCurrencyAmount(totalAmount)}{hasIncompleteAmount && <span className="ml-1 text-amber-400/70 text-base font-medium cursor-help" title="部分基金数据加载中，此处为已更新基金资产之和">*</span>}
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-700/60 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs mb-1 font-medium tracking-wide uppercase">累计总收益</span>
              <span className="text-xl lg:text-2xl font-bold font-mono">
                <FormatNumber value={totalProfit} isCurrency={true} />{hasIncompleteProfit && <span className="ml-1 text-amber-400/70 text-sm font-medium cursor-help" title="部分基金数据加载中，此处为已更新基金收益之和">*</span>}
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-700/60 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs mb-1 font-medium tracking-wide uppercase">{dailySummaryLabel}</span>
              <span className="text-3xl lg:text-4xl font-black font-mono filter drop-shadow-sm">
                <FormatNumber value={totalDailyProfit} isCurrency={true} />{hasIncompleteDaily && <span className="ml-1 text-amber-400/70 text-lg font-medium cursor-help" title="部分基金数据加载中，此处为已更新基金收益之和">*</span>}
              </span>
            </div>
          </div>
        </header>

        {/* --- 工具栏 --- */}
        <div className="flex-shrink-0 flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/50">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleOpenFundModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm shadow-sm hover:shadow-md hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0">
              <Plus className="w-4 h-4" /> 新增持仓
            </button>
            <button type="button" onClick={handleOpenCreateGroup} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm border border-indigo-200 shadow-sm hover:shadow-md hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0">
              <FolderPlus className="w-4 h-4" /> 创建分组
            </button>
            <button type="button" onClick={() => openModal('sync')} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm border border-slate-200 shadow-sm hover:shadow-md hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0">
              <ArrowRightLeft className="w-4 h-4" /> 同步交易
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-500 gap-3 shadow-inner">
              <span className="font-bold text-slate-600">数据源</span>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="auto">智能双阶段 (推荐)</option>
                <option value="tiantian">实时估值优先</option>
                <option value="eastmoney">收盘净值优先</option>
              </select>
              <span className="text-slate-400 font-medium">{valuationSourceHint || '按所选数据源展示'}</span>
            </div>
            <button type="button" onClick={handleOpenImportModal} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 text-xs border border-slate-200 hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0 shadow-sm hover:shadow-md">
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button type="button" onClick={() => openModal('export')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 text-xs border border-slate-200 hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0 shadow-sm hover:shadow-md">
              <Download className="w-4 h-4" /> 导出
            </button>
            <button type="button" onClick={handleRefresh} disabled={funds.length === 0} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 text-xs border border-slate-200 ml-0 lg:ml-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0 shadow-sm hover:shadow-md">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              {refreshButtonLabel}
            </button>
            <button type="button" onClick={handleLogout} className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 text-xs border border-rose-200 ml-0 lg:ml-2 hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0 shadow-sm hover:shadow-md">
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </div>

        {/* --- 主体表格区 --- */}
        <FundTable
          groupTableRef={groupTableRef}
          orderedGroups={orderedGroups}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          formatCurrencyAmount={formatCurrencyAmount}
          groupDailyLabel={groupDailyLabel}
          toNumber={toNumber}
          handleOpenFundDetail={handleOpenFundDetail}
          handleOpenHistory={handleOpenHistory}
          handleOpenSettings={handleOpenSettings}
          handleEditGroup={handleOpenEditGroup}
          handleDeleteGroup={handleDeleteGroup}
          ungroupedSector={UNGROUPED_SECTOR}
          funds={funds}
          sectors={sectors}
          dailyRateColumnLabel={dailyRateColumnLabel}
          dailyProfitColumnLabel={dailyProfitColumnLabel}
        />

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
        /* 全局美化滚动条与特化滚动条 */
        ::-webkit-scrollbar,
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track,
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb,
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
          transition: background 0.2s;
        }
        ::-webkit-scrollbar-thumb:hover,
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .add-fund-number-input::-webkit-outer-spin-button,
        .add-fund-number-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .add-fund-number-input { appearance: textfield; -moz-appearance: textfield; }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>

      <GroupModal
        isOpen={modals.group}
        onClose={handleCloseGroupModal}
        onSubmit={handleCreateGroup}
        value={groupForm.name}
        onChange={(name) => setGroupForm((current) => ({ ...current, name }))}
        mode={groupForm.mode}
        originalName={groupForm.originalName}
        canDelete={groupForm.mode === 'edit' && groupForm.originalName !== UNGROUPED_SECTOR}
        onDelete={() => {
          handleCloseGroupModal();
          handleDeleteGroup(groupForm.originalName);
        }}
      />

      <AddFundModal
        isOpen={modals.fund}
        onClose={handleCloseFundModal}
        onSubmit={handleAddFund}
        fundForm={fundForm}
        setFundForm={setFundForm}
        handleFundCodeChange={handleFundCodeChange}
        fundLookup={fundLookup}
        sectors={sectors}
      />

      <SyncTradeModal
        isOpen={modals.sync}
        onClose={() => closeModal('sync')}
        onSubmit={handleSyncTrade}
        syncForm={syncForm}
        onChange={setSyncForm}
      />

      <ImportModal
        isOpen={modals.import}
        onClose={handleCloseImportModal}
        importFileInputRef={importFileInputRef}
        importState={importState}
        onFileChange={handleImportFileChange}
        onModeChange={(mode) => setImportState((current) => ({ ...current, mode }))}
        onConfirm={handleConfirmImport}
      />

      <ExportModal
        isOpen={modals.export}
        onClose={() => closeModal('export')}
        onExport={handleExportData}
        fundsCount={funds.length}
        sectorsCount={sectors.length}
        transactionsCount={transactions.length}
        detailCacheCount={Object.keys(detailCacheEntries).length}
      />

      <HistoryModal
        isOpen={modals.history}
        onClose={handleCloseHistory}
        selectedFund={selectedFund}
        transactions={selectedFundTransactions}
        formatCurrencyAmount={formatCurrencyAmount}
        formatDateTimeLabel={formatDateTimeLabel}
        renderShareDelta={renderShareDelta}
        toNumber={toNumber}
      />

      <EditFundModal
        isOpen={modals.settings}
        onClose={() => closeModal('settings')}
        onSubmit={handleUpdateFund}
        onDelete={handleDeleteFund}
        editForm={editForm}
        setEditForm={setEditForm}
        sectors={sectors}
        toNumber={toNumber}
      />
    </div>
  </div>
  );
}
