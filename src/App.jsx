import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Upload, 
  ArrowRightLeft, 
  TrendingUp,
  TrendingDown,
  Settings,
  FolderPlus,
  Clock,
  LogOut,
  ChevronDown,
  ChevronRight,
  Camera,
  X,
  Search,
  AlertCircle,
  Info,
  Wallet,
  Flame,
  Cpu,
  GlassWater,
  Activity,
  Zap,
  Globe,
  ShieldCheck,
  Award,
  Users
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
import SyncModal from './components/modals/SyncModal';
import OcrSyncModal from './components/modals/OcrSyncModal';
import FundTable from './components/FundTable';
import AddFundModal from './components/forms/AddFundModal';
import EditFundModal from './components/forms/EditFundModal';
import GlobalMarketPanel from './components/market/GlobalMarketPanel';
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
  mergeDailyProfitsByDateAndCode,
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
    addedDate: typeof fund.addedDate === 'string' && fund.addedDate ? fund.addedDate : (() => {
      const numericId = Number(fund.id);
      if (Number.isFinite(numericId) && numericId > 1000000000000) {
        const d = new Date(numericId);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      if (typeof fund.createdAt === 'string' && fund.createdAt) {
        const parts = fund.createdAt.split(' ');
        if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
          return parts[0];
        }
        const tParts = fund.createdAt.split('T');
        if (tParts[0] && /^\d{4}-\d{2}-\d{2}$/.test(tParts[0])) {
          return tParts[0];
        }
      }
      return getTodayDateKey();
    })(),
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

  const quoteSource = overrides.quoteSource ?? fund.quoteSource;
  const isEstimated = quoteSource === 'estimate';
  const calculationNetValue = (isEstimated && lastNetValue > 0) ? lastNetValue : currentNetValue;

  const marketValue = hasTrackedShares
    ? (shares > 0 ? (calculationNetValue > 0 ? shares * calculationNetValue : (lastNetValue > 0 ? shares * lastNetValue : fallbackMarketValue)) : 0)
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
      // 备用加载东方财富主域名 (已关停该接口并返回 HTML，仅做极端情况保留)
      fallbackScript.src = `https://fundgz.eastmoney.com/js/${normalizedCode}.js?rt=${Date.now()}`;
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
    // 优先加载天天基金域名 (更稳定且正常返回 JS 格式的 JSONP 数据)
    script.src = `https://fundgz.1234567.com.cn/js/${normalizedCode}.js?rt=${Date.now()}`;
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
    const originalTrend = window.Data_netWorthTrend;
    const originalGrandTotal = window.Data_grandTotal;
    const originalFundRate = window.fund_Rate;
    const originalFundSourceRate = window.fund_sourceRate;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.getElementById(scriptId)?.remove();
      window.fund_Rate = originalFundRate;
      window.fund_sourceRate = originalFundSourceRate;
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
        const grandTotal = window.Data_grandTotal || [];

        let netWorthTrend = [];
        if (Array.isArray(window.Data_netWorthTrend)) {
          netWorthTrend = window.Data_netWorthTrend.map(p => {
            const d = new Date(p.x);
            return {
              date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
              netValue: p.y,
              dailyRate: p.equityReturn,
            };
          }).reverse();
        }

        const fundRate = window.fund_Rate || "";
        const fundSourceRate = window.fund_sourceRate || "";

        window.stockCodesNew = originalStockCodes;
        window.stockNames = originalStockNames;
        window.stockPercent = originalStockPercent;
        window.Data_netWorthTrend = originalTrend;
        window.Data_grandTotal = originalGrandTotal;

        cleanup();
        resolve({ stockCodes, stockNames, stockPercent, netWorthTrend, grandTotal, fundRate, fundSourceRate });
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

  const fetchIndustry = async () => {
    try {
      const res = await fetch(`/api/fund-industry?code=${normalizedCode}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("无法从 Pages 接口获取真实行业分布", e);
    }
    return [];
  };

  const [quoteResult, historyResult, holdingsResult, industryResult] = await Promise.allSettled([
    enqueueTiantianFundQuote(normalizedCode),
    enqueueEastmoneyOfficialHistoryRange(normalizedCode),
    loadPingzhongData(normalizedCode),
    fetchIndustry(),
  ]);

  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const holdingsData = holdingsResult.status === 'fulfilled' ? holdingsResult.value : null;
  const industries = industryResult.status === 'fulfilled' ? industryResult.value : [];
  
  const officialHistory = (holdingsData && holdingsData.netWorthTrend && holdingsData.netWorthTrend.length > 0)
    ? holdingsData.netWorthTrend
    : (historyResult.status === 'fulfilled' ? historyResult.value.history : []);

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
    industries,
    grandTotal: holdingsData?.grandTotal || [],
    fundRate: holdingsData?.fundRate || '',
    fundSourceRate: holdingsData?.fundSourceRate || '',
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
const isTradingHours = () => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeNum = hours * 100 + minutes;

  // A-share trading hours (with small buffers):
  // Morning: 9:30 - 11:35
  // Afternoon: 13:00 - 15:10
  const isMorning = timeNum >= 930 && timeNum <= 1135;
  const isAfternoon = timeNum >= 1300 && timeNum <= 1510;

  return isMorning || isAfternoon;
};

const MARKET_SECTORS = [
  { id: 'all', label: '🔥 全部热门', icon: Flame },
  { id: 'tech', label: '💻 科技芯片', icon: Cpu },
  { id: 'consumer', label: '🍷 消费白酒', icon: GlassWater },
  { id: 'healthcare', label: '🏥 医药健康', icon: Activity },
  { id: 'energy', label: '⚡ 新新能源', icon: Zap },
  { id: 'global', label: '🌍 全球指数', icon: Globe },
  { id: 'fixed', label: '💰 稳健理财', icon: ShieldCheck }
];

const CURATED_MARKET_FUNDS = [
  // 热门人气排行
  { 
    code: '161725', 
    name: '招商中证白酒指数(LOF)A', 
    category: '指数型', 
    sectorId: 'consumer',
    buyers: '345.8万', 
    recentGain: '+14.62%', 
    gainLabel: '近3月涨幅',
    hotScore: 99, 
    reason: '白酒基建，大盘权重与价值防御风向标',
    isHot: true,
    isGainer: true 
  },
  { 
    code: '005827', 
    name: '易方达蓝筹精选混合', 
    category: '混合型', 
    sectorId: 'consumer',
    buyers: '298.2万', 
    recentGain: '+11.85%', 
    gainLabel: '近3月涨幅',
    hotScore: 97, 
    reason: '张坤掌舵，布局港股互联网巨头与白酒龙头',
    isHot: true,
    isGainer: false 
  },
  { 
    code: '003096', 
    name: '中欧医疗健康混合C', 
    category: '混合型', 
    sectorId: 'healthcare',
    buyers: '215.4万', 
    recentGain: '+8.45%', 
    gainLabel: '近3月涨幅',
    hotScore: 93, 
    reason: '葛兰操盘，全方位配置核心创新药与CXO龙头',
    isHot: true,
    isGainer: false 
  },
  { 
    code: '007301', 
    name: '国联安半导体联接C', 
    category: '指数型', 
    sectorId: 'tech',
    buyers: '188.6万', 
    recentGain: '+24.50%', 
    gainLabel: '近3月涨幅',
    hotScore: 96, 
    reason: '硬核半导体，科技自立自强芯片核心先锋',
    isHot: true,
    isGainer: true 
  },
  { 
    code: '161028', 
    name: '富国新能源汽车指数C', 
    category: '指数型', 
    sectorId: 'energy',
    buyers: '142.5万', 
    recentGain: '+16.20%', 
    gainLabel: '近3月涨幅',
    hotScore: 90, 
    reason: '新能源汽车全产业链覆盖，绿色低碳排头兵',
    isHot: true,
    isGainer: true 
  },
  { 
    code: '513100', 
    name: '华夏纳斯达克100ETF联接A', 
    category: 'QDII-指数', 
    sectorId: 'global',
    buyers: '165.9万', 
    recentGain: '+21.80%', 
    gainLabel: '近3月涨幅',
    hotScore: 95, 
    reason: '美股科技长牛之源，捕获全球AI硬件核心巨头',
    isHot: true,
    isGainer: true 
  },
  
  // 科技芯片板块
  { 
    code: '008282', 
    name: '国泰CES半导体芯片行业ETF联接C', 
    category: '指数型', 
    sectorId: 'tech',
    buyers: '124.7万', 
    recentGain: '+23.85%', 
    gainLabel: '近3月涨幅',
    hotScore: 89, 
    reason: '全方位聚焦中国本土芯片龙头，弹性与爆发力极佳',
    isHot: false,
    isGainer: true 
  },
  { 
    code: '012348', 
    name: '天弘恒生科技指数(QDII)C', 
    category: 'QDII-指数', 
    sectorId: 'tech',
    buyers: '98.5万', 
    recentGain: '+18.15%', 
    gainLabel: '近3月涨幅',
    hotScore: 85, 
    reason: '一键低门槛配置腾讯、阿里、美团等港股互联网巨头',
    isHot: false,
    isGainer: true 
  },
  
  // 消费板块
  { 
    code: '001888', 
    name: '华安安信消费混合A', 
    category: '混合型', 
    sectorId: 'consumer',
    buyers: '65.2万', 
    recentGain: '+9.75%', 
    gainLabel: '近3月涨幅',
    hotScore: 78, 
    reason: '均衡打法全消费配置，长期历史超额收益与回撤控制佳',
    isHot: false,
    isGainer: false 
  },
  
  // 医药健康
  { 
    code: '006229', 
    name: '工银瑞信前沿医疗股票C', 
    category: '股票型', 
    sectorId: 'healthcare',
    buyers: '75.8万', 
    recentGain: '+10.25%', 
    gainLabel: '近3月涨幅',
    hotScore: 80, 
    reason: '老牌医疗主动管理代表，精选高壁垒前沿生物科技',
    isHot: false,
    isGainer: false 
  },
  { 
    code: '161726', 
    name: '招商国证生物医药指数(LOF)A', 
    category: '指数型', 
    sectorId: 'healthcare',
    buyers: '102.3万', 
    recentGain: '+7.80%', 
    gainLabel: '近3月涨幅',
    hotScore: 82, 
    reason: '聚焦高成长生物医药、疫苗及创新药产业链企业',
    isHot: false,
    isGainer: false 
  },
  
  // 新能源车与制造
  { 
    code: '003834', 
    name: '华夏能源革新股票A', 
    category: '股票型', 
    sectorId: 'energy',
    buyers: '115.6万', 
    recentGain: '+15.40%', 
    gainLabel: '近3月涨幅',
    hotScore: 88, 
    reason: '重点聚焦光伏、锂电、风能等未来绿色能源大变革赛道',
    isHot: false,
    isGainer: false 
  },
  { 
    code: '011102', 
    name: '天弘中证光伏产业指数C', 
    category: '指数型', 
    sectorId: 'energy',
    buyers: '84.2万', 
    recentGain: '+13.95%', 
    gainLabel: '近3月涨幅',
    hotScore: 83, 
    reason: '精准追踪中证光伏产业，满仓分享双碳红利与制造升级',
    isHot: false,
    isGainer: false 
  },
  
  // 全球指数
  { 
    code: '006479', 
    name: '广发纳斯达克100ETF联接A', 
    category: 'QDII-指数', 
    sectorId: 'global',
    buyers: '128.4万', 
    recentGain: '+21.55%', 
    gainLabel: '近3月涨幅',
    hotScore: 92, 
    reason: '紧密跟踪纳斯达克指数，分散配置海外硬科技与数字帝国',
    isHot: false,
    isGainer: true 
  },
  { 
    code: '000984', 
    name: '嘉实沪深300ETF联接A', 
    category: '指数型', 
    sectorId: 'global',
    buyers: '194.2万', 
    recentGain: '+7.12%', 
    gainLabel: '近3月涨幅',
    hotScore: 87, 
    reason: '追踪沪深两市规模最大、最具流动性的核心沪深蓝筹资产',
    isHot: false,
    isGainer: false 
  },
  
  // 稳健理财
  { 
    code: '006328', 
    name: '广发双债添利债券C', 
    category: '债券型', 
    sectorId: 'fixed',
    buyers: '89.4万', 
    recentGain: '+2.15%', 
    gainLabel: '近3月涨幅',
    hotScore: 86, 
    reason: '精选优质信用债与利率债，底仓配置抵御大盘波动的稳健港湾',
    isHot: false,
    isGainer: false 
  },
  { 
    code: '000198', 
    name: '天弘余额宝货币', 
    category: '货币型', 
    sectorId: 'fixed',
    buyers: '950万+', 
    recentGain: '+0.52%', 
    gainLabel: '近3月收益',
    hotScore: 94, 
    reason: '极致安全与极高流动性，随时取用随时消费的现金管理之王',
    isHot: false,
    isGainer: false 
  },
  { 
    code: '003293', 
    name: '易方达安盈回报混合A', 
    category: '偏债混合', 
    sectorId: 'fixed',
    buyers: '52.1万', 
    recentGain: '+3.45%', 
    gainLabel: '近3月涨幅',
    hotScore: 76, 
    reason: '固收打底，辅以大盘红利高股息股票精选，进可攻退可守',
    isHot: false,
    isGainer: false 
  }
];

export default function FundTrackerApp() {
  const todayStr = useMemo(() => getTodayDateKey(), []);
  
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [localDataStats, setLocalDataStats] = useState({ fundsCount: 0, txsCount: 0 });

  async function loadCloudData() {
    try {
      const [fundsRes, txsRes, profitsRes] = await Promise.all([
        fetch('/api/funds?_t=' + Date.now()),
        fetch('/api/transactions?_t=' + Date.now()),
        fetch('/api/daily-profits?_t=' + Date.now()).catch(e => {
          console.warn("每日收益拉取异常(可能表尚未创建):", e.message);
          return { ok: false };
        })
      ]);
      
      if (fundsRes.ok && txsRes.ok) {
        const fundsData = await fundsRes.json();
        const txsData = await txsRes.json();
        
        if (fundsData?.success && Array.isArray(fundsData.funds)) {
          const loadedFunds = normalizeStoredFunds(fundsData.funds);
          setFunds(loadedFunds);

          // 动态提取云端持仓的分组并合并到本地 sectors 列表中，防止自定义分组丢失
          const uniqueSectors = [...new Set(loadedFunds.map(f => f.sector).filter(Boolean))];
          setSectors(current => {
            const merged = [...current];
            uniqueSectors.forEach(sec => {
              if (!merged.includes(sec)) {
                const ungroupedIdx = merged.indexOf(UNGROUPED_SECTOR);
                if (ungroupedIdx !== -1) {
                  merged.splice(ungroupedIdx, 0, sec);
                } else {
                  merged.push(sec);
                }
              }
            });
            return merged;
          });
        }
        if (txsData?.success && Array.isArray(txsData.transactions)) {
          setTransactions(normalizeStoredTransactionStore(txsData.transactions).entries);
        }
        if (profitsRes && profitsRes.ok) {
          const profitsData = await profitsRes.json();
          if (profitsData?.success && Array.isArray(profitsData.dailyProfits)) {
            setDailyProfits(profitsData.dailyProfits);
          }
        }
      }
    } catch (err) {
      console.error('加载云端数据失败:', err);
    }
  }

  // Session detection & cloud fetch & sync logic
  useEffect(() => {
    async function checkSession() {
      // If running in local Vite development mode (port 5173), there is no backend server
      if (window.location.port === '5173') {
        return;
      }
      try {
        const res = await fetch('/api/auth/me?_t=' + Date.now(), {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (res.status === 401) {
          // If guest mode is enabled, we DO NOT redirect! We just set guest state.
          if (localStorage.getItem('fundTrackerGuestMode') === 'true') {
            setUser({ email: 'guest@local', isGuest: true, name: '免登录用户' });
            setIsAuthenticated(false);
            return;
          }
          // If port is not 5173, redirect to login page
          if (window.location.port !== '5173') {
            window.location.href = '/login.html';
          }
          return;
        }
        
        if (res.ok) {
          const authData = await res.json();
          if (authData?.authenticated && authData?.user) {
            // Clear guest mode flag if user actually logged in on backend
            localStorage.removeItem('fundTrackerGuestMode');
            
            const loggedInEmail = authData.user.email;
            setUser(authData.user);
            setIsAuthenticated(true);
            
            // Check if local data needs syncing
            const localFunds = readStoredJson('fundTrackerData', []);
            const localTxs = loadTransactions();
            const syncedUser = localStorage.getItem('fundTrackerSyncedUser');
            
            if (syncedUser !== loggedInEmail && (localFunds.length > 0 || localTxs.length > 0)) {
              // Open the premium sync modal!
              setLocalDataStats({ fundsCount: localFunds.length, txsCount: localTxs.length });
              setShowSyncModal(true);
            } else {
              // Already synced or no local data, directly load from D1
              await loadCloudData();
              localStorage.setItem('fundTrackerSyncedUser', loggedInEmail);
            }
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    }
    
    checkSession();
  }, []);

  const handleMergeToCloud = async () => {
    setSyncStatus('syncing');
    try {
      const localFunds = readStoredJson('fundTrackerData', []);
      const localTxs = loadTransactions();
      const localProfits = readStoredJson('fundTrackerDailyProfits', []);
      
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funds: localFunds,
          transactions: localTxs,
          dailyProfits: localProfits
        })
      });
      
      if (response.ok) {
        setSyncStatus('success');
        if (user?.email) {
          localStorage.setItem('fundTrackerSyncedUser', user.email);
        }
        // Backup local storage before clearing
        localStorage.setItem('fundTrackerData_backup_' + Date.now(), JSON.stringify(localFunds));
        localStorage.setItem('fundTrackerTransactions_backup_' + Date.now(), JSON.stringify(localTxs));
        localStorage.setItem('fundTrackerDailyProfits_backup_' + Date.now(), JSON.stringify(localProfits));
        
        // Fetch fresh merged data from D1 and set to state
        await loadCloudData();
        
        setTimeout(() => {
          setShowSyncModal(false);
          setSyncStatus('idle');
        }, 1500);
      } else {
        const errData = await response.json();
        alert(`同步失败: ${errData.error || '未知错误'}`);
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      alert(`网络错误，同步失败: ${err.message}`);
      setSyncStatus('error');
    }
  };

  const handleOverwriteWithCloud = async () => {
    setSyncStatus('syncing');
    try {
      if (user?.email) {
        localStorage.setItem('fundTrackerSyncedUser', user.email);
      }
      // Overwrite state directly from D1
      await loadCloudData();
      setSyncStatus('success');
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncStatus('idle');
      }, 1000);
    } catch (err) {
      console.error('Failed to overwrite with cloud:', err);
      alert('从云端拉取数据失败，请检查网络');
      setSyncStatus('idle');
    }
  };

  const handleLogout = async () => {
    // Clear guest mode flag and synced user flag on logout
    localStorage.removeItem('fundTrackerGuestMode');
    localStorage.removeItem('fundTrackerSyncedUser');

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
  const [dailyProfits, setDailyProfits] = useState(() => {
    return readStoredJson('fundTrackerDailyProfits', []);
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

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('fundTrackerDailyProfits', JSON.stringify(dailyProfits));
  }, [dailyProfits]);

  // 4. 监听变化：只要分组变了，立刻存入本地缓存
  useEffect(() => {
    localStorage.setItem('fundTrackerSectors', JSON.stringify(sectors));
  }, [sectors]);


  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  
  // 查找基金模块的状态与核心函数
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuotes, setSearchQuotes] = useState({});
  const [selectedMarketSector, setSelectedMarketSector] = useState('all'); // 'all' | 'tech' | 'consumer' | 'healthcare' | 'energy' | 'global' | 'fixed'
  const searchTimeoutRef = useRef(null);

  // 查找标签页开启且搜索为空时，自动并行预加载市场全局视角基金的实时行情
  useEffect(() => {
    if (activeTab === 'search' && !searchQuery.trim()) {
      let fundsToFetch = [];
      if (selectedMarketSector === 'all') {
        fundsToFetch = CURATED_MARKET_FUNDS;
      } else {
        fundsToFetch = CURATED_MARKET_FUNDS.filter(f => f.sectorId === selectedMarketSector);
      }
      
      fundsToFetch.forEach(fund => {
        fetchQuoteForSearchItem(fund.code);
      });
    }
  }, [activeTab, searchQuery, selectedMarketSector]);

  const searchFundClientSide = (keyword) => {
    return new Promise((resolve, reject) => {
      const callbackName = `search_callback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement('script');
      script.src = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}&callback=${callbackName}`;
      script.async = true;
      
      let settled = false;
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      
      window[callbackName] = (data) => {
        if (settled) return;
        settled = true;
        cleanup();
        
        const rawDatas = data?.Datas || [];
        const results = rawDatas.map(item => ({
          code: item.CODE || "",
          name: item.NAME || "",
          category: item.CATEGORY || "",
          spell: item.SPELL || ""
        }));
        resolve(results);
      };
      
      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP search failed'));
      };
      
      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP search timeout'));
      }, 5000);
      
      document.body.appendChild(script);
    });
  };

  const fetchQuoteForSearchItem = async (code) => {
    if (searchQuotes[code]) return;
    try {
      const quote = await enqueueTiantianFundQuote(code);
      if (quote) {
        setSearchQuotes(prev => ({
          ...prev,
          [code]: quote
        }));
      }
    } catch (e) {
      console.warn(`无法拉取搜索项 ${code} 的估值:`, e);
    }
  };

  const handleSearchQueryChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let datas = [];
        if (window.location.port === '5173') {
          datas = await searchFundClientSide(query);
        } else {
          try {
            const res = await fetch(`/api/search?key=${encodeURIComponent(query)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.datas) datas = data.datas;
            }
          } catch (err) {
            console.warn('Backend search API failed, trying JSONP', err);
            datas = await searchFundClientSide(query);
          }
        }
        setSearchResults(datas || []);
        
        if (datas && datas.length > 0) {
          datas.forEach(item => {
            fetchQuoteForSearchItem(item.code);
          });
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

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

  const [showTabProfit, setShowTabProfit] = useState(() => {
    const stored = localStorage.getItem('fundTrackerShowTabProfit');
    return stored !== null ? JSON.parse(stored) : true;
  });

  useEffect(() => {
    localStorage.setItem('fundTrackerShowTabProfit', JSON.stringify(showTabProfit));
  }, [showTabProfit]);

  const [modals, setModals] = useState({
    group: false, fund: false, sync: false, import: false, export: false, history: false, settings: false, ocr: false
  });
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

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
    const currentMonthPrefix = todayStr.slice(0, 7);

    // Get Monday of current week
    const refDate = new Date(todayStr + 'T00:00:00');
    const day = refDate.getDay();
    const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
    const mondayDate = new Date(refDate.setDate(diff));
    const year = mondayDate.getFullYear();
    const month = `${mondayDate.getMonth() + 1}`.padStart(2, '0');
    const dayOfMonth = `${mondayDate.getDate()}`.padStart(2, '0');
    const currentMondayStr = `${year}-${month}-${dayOfMonth}`;

    return funds.map((fund) => {
      const baseDisp = buildDisplayedFund(fund, selectedDataSource);

      // Aggregate weekly profits
      const weeklyLogs = dailyProfits.filter(dp => dp.fundCode === fund.code && dp.date >= currentMondayStr);
      const computedWeeklyProfit = weeklyLogs.length > 0
        ? weeklyLogs.reduce((sum, dp) => sum + dp.dailyProfit, 0)
        : toNumber(fund.weeklyProfit);

      // Aggregate monthly profits
      const monthlyLogs = dailyProfits.filter(dp => dp.fundCode === fund.code && dp.date.startsWith(currentMonthPrefix));
      const computedMonthlyProfit = monthlyLogs.length > 0
        ? monthlyLogs.reduce((sum, dp) => sum + dp.dailyProfit, 0)
        : toNumber(fund.monthlyProfit);

      return {
        ...baseDisp,
        weeklyProfit: roundAmount(computedWeeklyProfit),
        monthlyProfit: roundAmount(computedMonthlyProfit),
        sourceFund: fund,
      };
    });
  }, [funds, selectedDataSource, dailyProfits, todayStr]);

  // 自动记录每日收益到历史表中
  useEffect(() => {
    if (displayedFunds.length === 0) return;

    let changed = false;
    const nextDailyProfits = [...dailyProfits];

    displayedFunds.forEach((fund) => {
      const date = fund.netValueDate;
      const profit = fund.dailyProfit;
      const code = fund.code;

      if (code && date && /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof profit === 'number' && !Number.isNaN(profit)) {
        const existingIdx = nextDailyProfits.findIndex((dp) => dp.fundCode === code && dp.date === date);
        if (existingIdx !== -1) {
          if (nextDailyProfits[existingIdx].dailyProfit !== profit) {
            nextDailyProfits[existingIdx] = {
              ...nextDailyProfits[existingIdx],
              dailyProfit: profit,
            };
            changed = true;
          }
        } else {
          nextDailyProfits.push({
            id: `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            fundCode: code,
            date: date,
            dailyProfit: profit,
          });
          changed = true;
        }
      }
    });

    if (changed) {
      setDailyProfits(nextDailyProfits);
    }
  }, [displayedFunds]);

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
        if (fund.netValueDate === todayStr) {
          groups[targetSector].sectorDailyProfit += fund.dailyProfit;
          tDaily += fund.dailyProfit;
        }
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
  }, [displayedFunds, sectors, todayStr]);

  // 监听当日盈亏状态和隐私设置，实时同步更新网页标题和 Favicon 页签图标
  useEffect(() => {
    const baseTitle = '智能基金追踪';

    // 1. 动态更新网页标题 (Title) - 仅当开启时显示涨跌金额，否则为默认标题
    if (showTabProfit && totalDailyProfit !== null && totalDailyProfit !== undefined && Number.isFinite(totalDailyProfit)) {
      const sign = totalDailyProfit > 0 ? '+' : '';
      document.title = `${sign}${totalDailyProfit.toFixed(2)}元 | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }

    // 2. 动态更新页签图标 (Favicon) - 始终保持红涨绿跌动态趋势，不受隐私开关影响
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';

    let svgContent = '';
    if (totalDailyProfit > 0) {
      // 盈利：红色上涨趋势箭头
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
    } else if (totalDailyProfit < 0) {
      // 亏损：绿色下跌趋势箭头
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;
    } else {
      // 平盘或加载中：灰色上涨趋势箭头
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
    }

    link.href = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
    if (!document.querySelector("link[rel~='icon']")) {
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [totalDailyProfit, showTabProfit]);

  const activeDetailSourceFund = useMemo(() => {
    if (!detailView.code) return null;
    const found = funds.find((fund) => String(fund.code || '').trim() === detailView.code);
    if (found) return found;

    const sq = searchQuotes[detailView.code];
    const name = sq?.name || searchResults.find(r => r.code === detailView.code)?.name || '未定义基金';
    return {
      code: detailView.code,
      name,
      shares: 0,
      costAmount: 0,
      amount: 0,
      quoteSource: 'auto',
      holdingStartDate: '',
      addedDate: '',
    };
  }, [detailView.code, funds, searchQuotes, searchResults]);

  const activeDetailDisplayedFund = useMemo(() => {
    if (!detailView.code) return null;
    const found = displayedFunds.find((fund) => String(fund.code || '').trim() === detailView.code);
    if (found) return found;

    const sq = searchQuotes[detailView.code];
    const name = sq?.name || searchResults.find(r => r.code === detailView.code)?.name || '未定义基金';
    const dailyRateVal = sq?.dailyRate || 0;
    return {
      code: detailView.code,
      name,
      shares: 0,
      costAmount: 0,
      amount: 0,
      valuationSource: 'quote',
      totalProfit: 0,
      totalRate: 0,
      dailyProfit: 0,
      dailyRate: dailyRateVal,
    };
  }, [detailView.code, displayedFunds, searchQuotes, searchResults]);

  const activeDetailEntry = detailView.code ? detailCacheEntries[detailView.code] ?? null : null;
  const activeDetailRequestState = detailView.code
    ? (detailRequestStates[detailView.code] ?? { isLoading: false, error: '' })
    : { isLoading: false, error: '' };

  const activeDetailModel = useMemo(() => {
    if (!activeDetailSourceFund || !activeDetailDisplayedFund) return null;

    const fundTransactions = transactions.filter(t => t.fundCode === activeDetailSourceFund.code);
    const firstTransactionDate = fundTransactions.length > 0 
      ? [...fundTransactions].sort((a, b) => (a.tradeDate || '').localeCompare(b.tradeDate || ''))[0]?.tradeDate 
      : null;

    return buildFundDetailModel({
      sourceFund: activeDetailSourceFund,
      displayedFund: activeDetailDisplayedFund,
      totalPortfolioAmount: totalAmount,
      detailEntry: activeDetailEntry,
      firstTransactionDate,
    });
  }, [activeDetailDisplayedFund, activeDetailEntry, activeDetailSourceFund, totalAmount, transactions]);

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
    setSelectedFund(fund);
    setDetailView({ isOpen: true, code: fund.code });
    refreshFundDetail(fund.code, { force: true });
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

  useEffect(() => {
    if (funds.length === 0) return undefined;

    const timer = setInterval(() => {
      if (isTradingHours()) {
        handleRefresh();
      }
    }, 60000);

    return () => clearInterval(timer);
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

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    const normalizedName = String(groupForm.name || '').trim();
    if (!normalizedName) return;

    let nextSectors = [...sectors];
    let nextFunds = [...funds];

    if (groupForm.mode === 'edit') {
      const originalName = String(groupForm.originalName || '').trim();
      if (!originalName || originalName === UNGROUPED_SECTOR) return;
      if (normalizedName !== originalName && sectors.includes(normalizedName)) {
        alert('已存在同名分组，请换一个名称。');
        return;
      }

      nextSectors = sectors.map((sector) => (sector === originalName ? normalizedName : sector));
      nextFunds = funds.map((fund) => (
        fund.sector === originalName
          ? { ...fund, sector: normalizedName }
          : fund
      ));
    } else if (!sectors.includes(normalizedName)) {
      nextSectors = [...sectors, normalizedName];
    }

    if (isAuthenticated && groupForm.mode === 'edit') {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funds: nextFunds,
            transactions: transactions
          })
        });
        if (!response.ok) {
          const errData = await response.json();
          alert(`同步分组修改至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`同步分组修改至云端失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setSectors(nextSectors);
    if (groupForm.mode === 'edit') {
      setFunds(nextFunds);
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

  const handleDeleteGroup = async (sector) => {
    if (!sector || sector === UNGROUPED_SECTOR) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除分组“${sector}”吗？该分组下的基金将移动到“${UNGROUPED_SECTOR}”。`);
    if (!shouldDelete) {
      return;
    }

    const nextSectors = sectors.filter((item) => item !== sector);
    const updatedSectors = nextSectors.includes(UNGROUPED_SECTOR) ? nextSectors : [UNGROUPED_SECTOR, ...nextSectors];

    const nextFunds = funds.map((fund) => (
      fund.sector === sector
        ? { ...fund, sector: UNGROUPED_SECTOR }
        : fund
    ));

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funds: nextFunds,
            transactions: transactions
          })
        });
        if (!response.ok) {
          const errData = await response.json();
          alert(`同步删除分组至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`同步删除分组至云端失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setSectors(updatedSectors);
    setFunds(nextFunds);
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
      addedDate: getTodayDateKey(),
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

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newFund.id,
            code: newFund.code,
            name: newFund.name,
            sector: newFund.sector,
            quoteSource: newFund.quoteSource,
            holdingStartDate: newFund.holdingStartDate,
            bootstrapSharesFromAmount: newFund.bootstrapSharesFromAmount,
            shares: newFund.shares,
            costAmount: newFund.costAmount,
            amount: newFund.amount
          })
        });
        if (!response.ok) {
          const errData = await response.json();
          alert(`新增基金同步至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`新增基金同步至云端失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setFunds(prev => [...prev, newFund]);

    handleCloseFundModal();
    
    if (collapsedGroups.has(newFund.sector)) {
      toggleGroup(newFund.sector);
    }
  };

  const handleOpenSyncTrade = async (fund) => {
    const cacheEntry = detailCacheEntries[fund.code];
    let fundRateStr = cacheEntry?.fundRate || '';

    setSyncForm({
      code: fund.code,
      type: '买入',
      fee: '',
      tradeDate: getTodayDateKey(),
      confirmTime: 'before15',
      amount: '',
      feeRate: fundRateStr,
    });
    openModal('sync');

    if (!fundRateStr) {
      try {
        const holdingsData = await loadPingzhongData(fund.code);
        if (holdingsData && holdingsData.fundRate) {
          fundRateStr = holdingsData.fundRate;
          
          setDetailCacheEntries(currentEntries => {
            const entry = currentEntries[fund.code];
            if (entry) {
              return {
                ...currentEntries,
                [fund.code]: {
                  ...entry,
                  fundRate: fundRateStr,
                  fundSourceRate: holdingsData.fundSourceRate || '',
                }
              };
            }
            return currentEntries;
          });

          setSyncForm(prev => {
            if (prev.code === fund.code) {
              return {
                ...prev,
                feeRate: fundRateStr,
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('后台获取申购费率失败:', err);
      }
    }
  };

  const handleSyncTrade = async (e) => {
    e.preventDefault();

    const normalizedCode = String(syncForm.code || '').trim();
    const existingFundIndex = funds.findIndex(f => String(f.code || '').trim() === normalizedCode);

    let targetFund = null;
    let quote = null;

    if (existingFundIndex === -1) {
      // 这是一个新买入的基金！
      // 1. 查询其实时信息，确保有正确的基金名称
      setIsRefreshing(true);
      try {
        quote = await enqueueTiantianFundQuote(normalizedCode);
      } catch (error) {
        console.warn(`自动建仓时获取估值失败: ${normalizedCode}`, error);
      }
      setIsRefreshing(false);

      if (!quote || !quote.name) {
        alert('无法获取该基金的官方基本信息，无法完成自动建仓。请检查基金代码是否正确。');
        return;
      }

      // 2. 构造一个初始的自选基金对象 (持仓份额与金额初始为 0，归属分组为选中的 sector)
      const selectedSector = syncForm.sector || '未分组';
      const lastNetValueVal = quote.lastNetValue || 0;
      const estimatedNetValueVal = quote.estimatedNetValue || 0;
      const refNetValueVal = estimatedNetValueVal > 0 ? estimatedNetValueVal : (lastNetValueVal > 0 ? lastNetValueVal : 0);

      const baseFund = {
        id: `uf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: String(quote.name || '').trim() || '未命名基金',
        code: normalizedCode,
        sector: selectedSector,
        shares: 0,
        costAmount: 0,
        amount: 0,
        currentNetValue: refNetValueVal,
        lastNetValue: lastNetValueVal,
        lastValuationTime: quote.updateTime || '',
        netValueDate: quote.netValueDate || '',
        bootstrapSharesFromAmount: false,
        quoteSource: getQuoteSourceFromQuote(quote),
        dailyRate: quote.dailyRate || 0,
        weeklyProfit: 0,
        monthlyProfit: 0,
        holdingStartDate: '',
        addedDate: getTodayDateKey(),
      };

      let newFund = buildFundSnapshot(baseFund);

      try {
        const officialSnapshot = await enqueueEastmoneyOfficialHistory(normalizedCode);
        newFund = applyOfficialNetValueToFund(newFund, officialSnapshot);
      } catch (error) {
        console.warn(`自动建仓时获取官方昨日净值失败: ${normalizedCode}`, error);
      }

      if (shouldPreferOfficialValuation(newFund)) {
        newFund = {
          ...newFund,
          ...buildOfficialValuationFund(newFund)
        };
      } else {
        newFund = buildFundSnapshot(newFund);
      }

      targetFund = newFund;
    } else {
      targetFund = funds[existingFundIndex];
      try {
        quote = await enqueueTiantianFundQuote(targetFund.code);
      } catch (error) {
        console.warn(`同步交易时获取估值失败: ${targetFund.code}`, error);
      }
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

    const updatedFund = applyTradeToFund(targetFund, tradePayload, quote, finalTradeDate);

    if (isAuthenticated) {
      try {
        if (transactionRecord) {
          const txRes = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionRecord)
          });
          if (!txRes.ok) {
            const errData = await txRes.json();
            alert(`交易记录同步至云端失败: ${errData.error || '未知错误'}`);
            return;
          }
        }

        const fundRes = await fetch('/api/funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: updatedFund.id,
            code: updatedFund.code,
            name: updatedFund.name,
            sector: updatedFund.sector,
            quoteSource: updatedFund.quoteSource,
            holdingStartDate: updatedFund.holdingStartDate,
            bootstrapSharesFromAmount: updatedFund.bootstrapSharesFromAmount,
            shares: updatedFund.shares,
            costAmount: updatedFund.costAmount,
            amount: updatedFund.amount
          })
        });
        if (!fundRes.ok) {
          const errData = await fundRes.json();
          alert(`持仓配置同步至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`同步交易失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setFunds((currentFunds) => {
      const exists = currentFunds.some(f => f.id === targetFund.id);
      if (exists) {
        return currentFunds.map((fund) => fund.id === targetFund.id ? updatedFund : fund);
      }
      return [...currentFunds, updatedFund];
    });

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

  const handleBatchOcrSync = async (validRows) => {
    setIsRefreshing(true);
    setRefreshButtonLabel('正在导入 OCR 交易...');
    
    // Sort rows chronologically (earliest first) to compute correct cost compounding!
    const sortedRows = [...validRows].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
    
    let workingFunds = [...funds];
    let newTransactions = [];
    let newFundsCreated = [];

    try {
      for (const row of sortedRows) {
        let quote = null;
        try {
          quote = await enqueueTiantianFundQuote(row.code);
        } catch (error) {
          console.warn(`OCR 导入时获取估值失败: ${row.code}`, error);
        }

        // Find existing fund in working copy (could be newly added in previous iteration)
        let targetFundIndex = workingFunds.findIndex(f => String(f.code || '').trim() === row.code);
        let targetFund = null;
        
        if (targetFundIndex === -1) {
          // Create new fund holding snapshot
          const lastNetValueVal = quote?.lastNetValue || 0;
          const estimatedNetValueVal = quote?.estimatedNetValue || 0;
          const refNetValueVal = estimatedNetValueVal > 0 ? estimatedNetValueVal : (lastNetValueVal > 0 ? lastNetValueVal : 0);
          
          const baseFund = {
            id: Date.now() + Math.floor(Math.random() * 100000),
            name: String(quote?.name || row.name || '').trim() || '未命名基金',
            code: row.code,
            sector: UNGROUPED_SECTOR,
            shares: 0,
            costAmount: 0,
            amount: 0,
            currentNetValue: refNetValueVal,
            lastNetValue: lastNetValueVal,
            lastValuationTime: quote?.updateTime || '',
            netValueDate: quote?.netValueDate || '',
            bootstrapSharesFromAmount: false,
            quoteSource: quote ? getQuoteSourceFromQuote(quote) : 'auto',
            dailyRate: quote?.dailyRate || 0,
            weeklyProfit: 0,
            monthlyProfit: 0,
            holdingStartDate: '',
            addedDate: getTodayDateKey(),
          };
          
          targetFund = buildFundSnapshot(baseFund);
          workingFunds.push(targetFund);
          targetFundIndex = workingFunds.length - 1;
          newFundsCreated.push(targetFund);
        } else {
          targetFund = workingFunds[targetFundIndex];
        }

        const tradeReferenceFund = quote ? reconcileFundWithQuote(targetFund, quote) : { ...targetFund, quoteSource: inferStoredQuoteSource(targetFund) };
        const lastNetValue = toNumber(tradeReferenceFund.lastNetValue);
        const referenceNetValue = lastNetValue > 0 ? lastNetValue : getDisplayedReferenceNetValue(tradeReferenceFund);

        if (referenceNetValue <= 0) {
          console.warn(`基金 ${row.code} 没有可用参考净值，跳过此交易。`);
          continue;
        }

        // Determine confirmTime (before15 or after15)
        const timePart = row.tradeDate.split(' ')[1] || '10:00:00';
        const hour = parseInt(timePart.split(':')[0]) || 10;
        const confirmTime = hour >= 15 ? 'after15' : 'before15';
        
        const baseTradeDate = row.tradeDate.split(' ')[0] || getTodayDateKey();
        const finalTradeDate = confirmTime === 'before15' ? baseTradeDate : addOneDay(baseTradeDate);

        const tradePayload = {
          type: row.type,
          volumeType: 'amount',
          amount: row.amount,
          fee: row.fee || 0,
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
          console.warn(`交易无效，跳过此记录: ${row.code}`);
          continue;
        }

        const transactionRecord = buildTransactionRecord({
          fund: tradeReferenceFund,
          tradeImpact,
          source: 'ocr-screenshot',
          note: `OCR导入:原名(${row.name})`
        });

        const updatedFund = applyTradeToFund(targetFund, tradePayload, quote, finalTradeDate);
        workingFunds[targetFundIndex] = updatedFund;

        if (transactionRecord) {
          newTransactions.push(transactionRecord);
        }
      }

      // Persist to D1 Cloud DB if authenticated
      if (isAuthenticated) {
        try {
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              funds: workingFunds,
              transactions: [...transactions, ...newTransactions]
            })
          });
          if (!response.ok) {
            const errData = await response.json();
            alert(`云端数据批量同步失败: ${errData.error || '未知错误'}`);
            return;
          }
        } catch (err) {
          alert(`云端数据批量同步失败，请检查网络: ${err.message}`);
          return;
        }
      }

      setFunds(workingFunds);
      if (newTransactions.length > 0) {
        setTransactions(currentTxs => sortTransactionsByDateDesc([...currentTxs, ...newTransactions]));
      }

      closeModal('ocr');
      alert(`导入成功！成功同步并登记了 ${newTransactions.length} 笔交易记录，新增了 ${newFundsCreated.length} 只持有基金！`);
      
      // Auto refresh to recalculate holding returns
      handleRefresh();

    } catch (e) {
      console.error(e);
      alert(`批量导入过程中出错: ${e.message}`);
    } finally {
      setIsRefreshing(false);
      setRefreshButtonLabel('刷新估值');
    }
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
      dailyProfits,
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
        dailyProfitsCount: (parsedPayload.data.dailyProfits ?? []).length,
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
          dailyProfits: parsedPayload.data.dailyProfits ?? [],
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

  const handleConfirmImport = async () => {
    if (!importState.payload) {
      return;
    }

    let nextFunds = [];
    let nextSectors = [];
    let nextDetailCache = [];
    let nextTransactions = [];
    let nextDailyProfits = [];

    if (importState.mode === 'replace-all') {
      nextFunds = importState.payload.funds;
      nextSectors = importState.payload.sectors;
      nextDetailCache = importState.payload.detailCacheEntries;
      nextTransactions = sortTransactionsByDateDesc(importState.payload.transactions);
      nextDailyProfits = importState.payload.dailyProfits;
    } else {
      nextFunds = mergeImportedFunds(funds, importState.payload.funds);
      nextSectors = mergeStringArrays(sectors, importState.payload.sectors);
      nextDetailCache = mergeDetailCacheEntries(detailCacheEntries, importState.payload.detailCacheEntries);
      nextTransactions = sortTransactionsByDateDesc(mergeTransactionsById(transactions, importState.payload.transactions));
      nextDailyProfits = mergeDailyProfitsByDateAndCode(dailyProfits, importState.payload.dailyProfits);
    }

    if (isAuthenticated) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funds: nextFunds,
            transactions: nextTransactions,
            dailyProfits: nextDailyProfits
          })
        });
        if (!response.ok) {
          const errData = await response.json();
          alert(`同步至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`同步至云端失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setFunds(nextFunds);
    setSectors(nextSectors);
    setDetailCacheEntries(nextDetailCache);
    setTransactions(nextTransactions);
    setDailyProfits(nextDailyProfits);

    setSelectedFund(null);
    setDetailView({ isOpen: false, code: '' });
    handleCloseImportModal();
    alert(importState.mode === 'replace-all' ? '导入成功，当前数据已完成替换并同步至云端。' : '导入成功，已按追加模式合并数据并同步至云端。');
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
      if (isAuthenticated) {
        try {
          const response = await fetch('/api/funds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: updatedTarget.id,
              code: updatedTarget.code,
              name: updatedTarget.name,
              sector: updatedTarget.sector,
              quoteSource: updatedTarget.quoteSource,
              holdingStartDate: updatedTarget.holdingStartDate,
              bootstrapSharesFromAmount: updatedTarget.bootstrapSharesFromAmount,
              shares: updatedTarget.shares,
              costAmount: updatedTarget.costAmount,
              amount: updatedTarget.amount
            })
          });
          if (!response.ok) {
            const errData = await response.json();
            alert(`更新配置同步至云端失败: ${errData.error || '未知错误'}`);
            return;
          }
        } catch (err) {
          alert(`更新配置同步至云端失败，请检查网络: ${err.message}`);
          return;
        }
      }

      setFunds((currentFunds) => currentFunds.map((fund) => (
        fund.id === editForm.id ? updatedTarget : fund
      )));
    }
    closeModal('settings');
  };

  const handleDeleteFund = async () => {
    if (detailView.code && String(editForm.code || '').trim() === detailView.code) {
      handleCloseFundDetail();
    }

    if (isAuthenticated) {
      try {
        const response = await fetch(`/api/funds?code=${editForm.code}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          const errData = await response.json();
          alert(`删除自选同步至云端失败: ${errData.error || '未知错误'}`);
          return;
        }
      } catch (err) {
        alert(`删除自选同步至云端失败，请检查网络: ${err.message}`);
        return;
      }
    }

    setFunds((currentFunds) => currentFunds.filter((fund) => fund.id !== editForm.id));
    setDailyProfits((currentProfits) => currentProfits.filter((dp) => dp.fundCode !== editForm.code));
    closeModal('settings');
  };

  const handleOpenSyncTradeForNewFund = (code, name) => {
    const quote = searchQuotes[code];
    let fundRateStr = quote?.fundRate || '';

    setSyncForm({
      code: code,
      type: '买入',
      fee: '',
      tradeDate: getTodayDateKey(),
      confirmTime: 'before15',
      amount: '',
      feeRate: fundRateStr,
      sector: sectors[0] || '未分组',
    });
    openModal('sync');
  };

  const renderSearchTab = () => {
    const recommendations = CURATED_MARKET_FUNDS.slice(0, 6);

    const renderFundRow = (item, index, badgeType = 'number') => {
      const quote = searchQuotes[item.code];
      const isExisting = funds.some(f => String(f.code || '').trim() === item.code);
      
      const lastValue = quote?.lastNetValue || 0;
      const estimatedValue = quote?.estimatedNetValue || 0;
      const displayValue = estimatedValue > 0 ? estimatedValue : (lastValue > 0 ? lastValue : null);
      const dailyRate = quote?.dailyRate || 0;
      
      const rateColorClass = dailyRate > 0 
        ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
        : dailyRate < 0 
          ? 'text-emerald-600 bg-emerald-50 border-emerald-100/60' 
          : 'text-slate-500 bg-slate-50 border-slate-150';

      // Left Badge (Rank cup or Sector Icon)
      let badgeElement = null;
      if (badgeType === 'rank') {
        const colors = [
          'bg-amber-100 text-amber-800 border-amber-250',
          'bg-slate-100 text-slate-700 border-slate-250',
          'bg-orange-100 text-orange-800 border-orange-250',
        ];
        const color = colors[index] || 'bg-slate-50 text-slate-400 border-slate-200';
        badgeElement = (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border ${color} shrink-0`}>
            {index + 1}
          </div>
        );
      } else {
        badgeElement = (
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
        );
      }

      return (
        <div 
          key={item.code} 
          onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
          className="flex items-center justify-between p-3.5 bg-gradient-to-r from-white to-slate-50/40 border border-slate-200/60 rounded-xl hover:bg-slate-50 active:bg-slate-100/80 transition-all cursor-pointer shadow-2xs relative overflow-hidden"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
            {badgeElement}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-slate-800 text-[14px] leading-snug line-clamp-1" title={item.name}>
                  {item.name}
                </h4>
                {isExisting && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black bg-emerald-500 text-white leading-none scale-90 origin-left">已持仓</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-mono tracking-wider leading-none scale-95 origin-left shrink-0 whitespace-nowrap">{item.code}</span>
                <span className="text-[9.5px] font-bold text-slate-400 bg-slate-100 border border-slate-200/40 px-1.5 py-0.5 rounded leading-none scale-95 origin-left shrink-0 whitespace-nowrap">{item.category || '公募基金'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end gap-1 min-w-[65px] shrink-0">
              <div className={`inline-flex items-center justify-center px-2 py-1 border rounded-lg font-mono font-bold text-[11px] min-w-[65px] text-center leading-none ${rateColorClass}`}>
                {dailyRate > 0 ? '+' : ''}{dailyRate.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-slate-500 font-semibold leading-none mt-1 whitespace-nowrap shrink-0">
                {displayValue !== null ? displayValue.toFixed(4) : '--'}
                <span className="text-[8.5px] text-slate-400 ml-0.5 scale-90 inline-block font-sans font-medium">
                  {quote?.quoteSource === 'estimate' ? '估' : '实'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenSyncTradeForNewFund(item.code, item.name);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-700 active:to-indigo-700 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xs hover:shadow-xs active:scale-[0.88] transition-all cursor-pointer shrink-0"
              title="添加买入交易"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      );
    };
      const renderRankingsView = () => {
        const popularFunds = [...CURATED_MARKET_FUNDS].sort((a, b) => b.hotScore - a.hotScore).slice(0, 5);
        const gainerFunds = [...CURATED_MARKET_FUNDS]
          .sort((a, b) => parseFloat(b.recentGain) - parseFloat(a.recentGain))
          .slice(0, 5);

        return (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Popular List */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs md:text-sm flex items-center gap-1.5 select-none">
                  <Flame className="w-4.5 h-4.5 text-orange-500 fill-orange-500" />
                  <span>市场热门关注排行</span>
                </h4>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">实时热度更新</span>
              </div>
              <div className="flex flex-col gap-3">
                {popularFunds.map((item, index) => renderFundRow(item, index, 'rank'))}
              </div>
            </div>

            {/* Gainer List */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-extrabold text-slate-800 text-xs md:text-sm flex items-center gap-1.5 select-none">
                  <TrendingUp className="w-4.5 h-4.5 text-rose-500" />
                  <span>近期行业领涨先锋</span>
                </h4>
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">近3月收益率排行</span>
              </div>
              <div className="flex flex-col gap-3">
                {gainerFunds.map((item, index) => renderFundRow(item, index, 'rank'))}
              </div>
            </div>
          </div>
        );
      };

    const renderSectorGridView = () => {
      const sectorFunds = CURATED_MARKET_FUNDS.filter(f => f.sectorId === selectedMarketSector);

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {sectorFunds.map(item => {
            const quote = searchQuotes[item.code];
            const isExisting = funds.some(f => String(f.code || '').trim() === item.code);
            
            const lastValue = quote?.lastNetValue || 0;
            const estimatedValue = quote?.estimatedNetValue || 0;
            const displayValue = estimatedValue > 0 ? estimatedValue : (lastValue > 0 ? lastValue : null);
            const dailyRate = quote?.dailyRate || 0;
            
            const rateColorClass = dailyRate > 0 
              ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
              : dailyRate < 0 
                ? 'text-emerald-600 bg-emerald-50 border-emerald-100/60' 
                : 'text-slate-500 bg-slate-50 border-slate-150';

            return (
              <div 
                key={item.code} 
                className="border border-slate-200/60 hover:border-slate-350 rounded-2xl p-5 bg-gradient-to-br from-white to-slate-50/20 hover:to-slate-50/50 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group overflow-hidden"
              >
                {/* Corner Badge */}
                <div className="absolute right-0 top-0">
                  {isExisting ? (
                    <span className="inline-flex items-center gap-0.5 px-3 py-1 rounded-bl-xl text-[9px] font-black bg-rose-500 text-white shadow-xs tracking-wider uppercase leading-none">已在持仓</span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-3 py-1 rounded-bl-xl text-[9px] font-black bg-blue-500 text-white shadow-xs tracking-wider uppercase leading-none">未加自选</span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Code and Category tags */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100/60 px-2 py-0.5 rounded font-mono tracking-wider">{item.code}</span>
                    <span className="text-[9.5px] font-bold text-slate-400 bg-slate-100 border border-slate-200/40 px-2 py-0.5 rounded">{item.category}</span>
                  </div>

                  {/* Fund Name */}
                  <div className="min-h-11">
                    <h4 
                      className="font-extrabold text-slate-700 group-hover:text-blue-700 transition-colors text-[13.5px] leading-snug cursor-pointer line-clamp-2"
                      title={item.name}
                      onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
                    >
                      {item.name}
                    </h4>
                  </div>

                  {/* Theme/Reason text */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10.5px] text-slate-500 leading-relaxed font-semibold">
                    {item.reason}
                  </div>

                  {/* Real-time details or Skeleton */}
                  {quote ? (
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-150/40 pt-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/30">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                          {quote?.quoteSource === 'estimate' ? '估算净值' : '最新净值'}
                        </span>
                        <span className="text-[13.5px] font-extrabold text-slate-700 font-mono tracking-tight mt-0.5">
                          {displayValue !== null ? displayValue.toFixed(4) : '--'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">估算涨幅</span>
                        <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 border rounded-lg font-mono font-bold text-[10.5px] mt-0.5 w-fit leading-none ${rateColorClass}`}>
                          {dailyRate > 0 ? '+' : ''}{dailyRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* skeleton quotes */
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-150/40 pt-3 animate-pulse bg-slate-50/20 p-2.5 rounded-xl border border-slate-100">
                      <div className="space-y-1.5">
                        <div className="h-3 w-8 bg-slate-100 rounded" />
                        <div className="h-4 w-14 bg-slate-100 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-3 w-8 bg-slate-100 rounded" />
                        <div className="h-4 w-12 bg-slate-100 rounded" />
                      </div>
                    </div>
                  )}

                  {/* Simulated metadata: Buyers and Gains */}
                  <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-extrabold bg-slate-50/30 border border-slate-100/50 p-2 rounded-xl mt-1 select-none">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> {item.buyers} 关注</span>
                    <span className="text-rose-600">{item.gainLabel} {item.recentGain}</span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="grid grid-cols-2 gap-2 mt-4.5">
                  <button
                    type="button"
                    onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
                    className="flex items-center justify-center gap-1 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 py-2 rounded-xl text-xs font-bold text-slate-650 transition-all shadow-3xs hover:shadow-2xs active:scale-[0.98]"
                  >
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>查看详情</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSyncTradeForNewFund(item.code, item.name)}
                    className="flex items-center justify-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-2 rounded-xl text-xs font-black text-white shadow-3xs hover:shadow-2xs transition-all active:scale-[0.98]"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-200" />
                    <span>添加买入</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const displayResults = searchQuery.trim() ? searchResults : [];

    return (
      <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-md border border-slate-200/60 flex flex-col min-h-[300px] overflow-hidden">
        {/* 搜索控制台 */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4.5 h-4.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchQueryChange}
              placeholder="输入基金名称、代码或拼音简拼搜索，如：易方达、005827..."
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-700 placeholder-slate-400 shadow-sm transition-all text-sm md:text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
          
          {!searchQuery.trim() && (
            <div className="flex items-center gap-2 mt-3 text-xs font-bold text-slate-400 overflow-hidden w-full select-none">
              <span className="uppercase tracking-wider shrink-0">热门搜索：</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none flex-nowrap flex-1 py-0.5 -my-0.5">
                {recommendations.map(rec => (
                  <button
                    key={rec.code}
                    type="button"
                    onClick={() => {
                      setSearchQuery(rec.code);
                      handleSearchQueryChange({ target: { value: rec.code } });
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all font-semibold shadow-2xs shrink-0 whitespace-nowrap font-sans cursor-pointer"
                  >
                    {rec.name.slice(0, 6)} ({rec.code})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 市场全局分类导航栏 (仅在未搜索时渲染) */}
        {!searchQuery.trim() && (
          <div className="px-4 md:px-6 py-2.5 bg-slate-50/30 border-b border-slate-100 flex items-center gap-3 overflow-hidden shrink-0">
            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-450 shrink-0 select-none">全局透视：</span>
            <div className="flex gap-2 overflow-x-auto scrollbar-none flex-nowrap flex-1 py-1 -my-1">
              {MARKET_SECTORS.map(sec => {
                const isSelected = selectedMarketSector === sec.id;
                const IconComponent = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedMarketSector(sec.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-300 shadow-3xs active:scale-[0.96] shrink-0 border cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-500 text-white font-black' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <span>{sec.label.replace(/[\uD800-\uDFFF].\s*/, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 结果/全局呈现区 */}
        <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
          {searchQuery.trim() ? (
            /* ================= 搜索状态下展示结果 ================= */
            isSearching ? (
              /* 响应式双态骨架屏加载态 */
              <div>
                <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="border border-slate-100 rounded-2xl p-5 space-y-4 bg-white animate-pulse shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="h-5 w-12 bg-slate-100 rounded-md" />
                        <div className="h-4 w-14 bg-slate-100 rounded-md" />
                      </div>
                      <div className="h-6 w-3/4 bg-slate-100 rounded-md" />
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-100/60 pt-4">
                        <div className="space-y-1.5">
                          <div className="h-3 w-8 bg-slate-100 rounded" />
                          <div className="h-5 w-16 bg-slate-100 rounded" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-3 w-8 bg-slate-100 rounded" />
                          <div className="h-5 w-16 bg-slate-100 rounded" />
                        </div>
                      </div>
                      <div className="h-8 bg-slate-100 rounded-xl" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 md:hidden">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/50 rounded-xl animate-pulse shadow-2xs">
                      <div className="flex-1 space-y-2 pr-4">
                        <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-3.5 bg-slate-100 rounded w-12 animate-pulse" />
                          <div className="h-3.5 bg-slate-100 rounded w-16 animate-pulse" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right space-y-1.5 shrink-0">
                          <div className="h-4 bg-slate-100 rounded w-16 animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded w-10 ml-auto animate-pulse" />
                        </div>
                        <div className="w-8 h-8 bg-slate-100 rounded-full shrink-0 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : displayResults.length === 0 ? (
              /* 空数据状态 */
              <div className="flex flex-col items-center justify-center text-center py-20 px-4 animate-in fade-in duration-305">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl text-slate-450 shadow-inner mb-4">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h4 className="text-base font-extrabold text-slate-800">没有找到匹配的基金</h4>
                <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed font-semibold">
                  请核对基金六位代码是否输入正确，或者更换名称关键字重新查询。
                </p>
              </div>
            ) : (
              <div>
                {/* 桌面端：卡片网格展示 */}
                <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-200">
                  {displayResults.map(item => {
                    const quote = searchQuotes[item.code];
                    const isExisting = funds.some(f => String(f.code || '').trim() === item.code);
                    
                    const lastValue = quote?.lastNetValue || 0;
                    const estimatedValue = quote?.estimatedNetValue || 0;
                    const displayValue = estimatedValue > 0 ? estimatedValue : (lastValue > 0 ? lastValue : null);
                    const dailyRate = quote?.dailyRate || 0;
                    
                    const rateColorClass = dailyRate > 0 
                      ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
                      : dailyRate < 0 
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-100/60' 
                        : 'text-slate-500 bg-slate-50 border-slate-150';

                    return (
                      <div 
                        key={item.code} 
                        className="border border-slate-200/60 rounded-2xl p-5 bg-gradient-to-br from-white to-slate-50/30 flex flex-col justify-between hover:shadow-lg hover:border-slate-300 transition-all duration-300 relative group overflow-hidden"
                      >
                        {/* 新持仓/已持仓角标 */}
                        <div className="absolute right-0 top-0">
                          {isExisting ? (
                            <span className="inline-flex items-center gap-0.5 px-3 py-1 rounded-bl-xl text-[9px] font-black bg-rose-500 text-white shadow-sm tracking-wider uppercase leading-none">已在持仓</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-3 py-1 rounded-bl-xl text-[9px] font-black bg-blue-500 text-white shadow-sm tracking-wider uppercase leading-none">未加自选</span>
                          )}
                        </div>

                        <div className="space-y-3.5">
                          {/* 顶部代码与类别 */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-mono tracking-wider">{item.code}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/40 px-2 py-0.5 rounded-md">{item.category || '公募基金'}</span>
                          </div>

                          {/* 基金名称 */}
                          <div className="min-h-11">
                            <h4 
                              className="font-extrabold text-slate-700 group-hover:text-blue-700 transition-colors text-[14px] leading-snug cursor-pointer line-clamp-2"
                              title={item.name}
                              onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
                            >
                              {item.name}
                            </h4>
                          </div>

                          {/* 细致行情卡数据面板 */}
                          <div className="grid grid-cols-2 gap-3 border-t border-slate-150/40 pt-3.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/30">
                            <div className="flex flex-col">
                              <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                                {quote?.quoteSource === 'estimate' ? '估算净值' : '最新净值'}
                              </span>
                              <span className="text-[14.5px] font-extrabold text-slate-700 font-mono tracking-tight mt-0.5">
                                {displayValue !== null ? displayValue.toFixed(4) : '--'}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">估算涨幅</span>
                              <div className={`inline-flex items-center gap-0.5 px-2 py-0.5 border rounded-lg font-mono font-bold text-xs mt-0.5 w-fit ${rateColorClass}`}>
                                {dailyRate > 0 ? '+' : ''}{dailyRate.toFixed(2)}%
                              </div>
                            </div>
                          </div>

                          {/* 行情更新时间 */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                            <span>估值时间</span>
                            <span className="font-mono font-bold">{quote?.updateTime || '--:--:--'}</span>
                          </div>
                        </div>

                        {/* 底部操作按钮 */}
                        <div className="grid grid-cols-2 gap-2.5 mt-5">
                          <button
                            type="button"
                            onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
                            className="flex items-center justify-center gap-1 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 py-2 rounded-xl text-xs font-bold text-slate-600 transition-all shadow-2xs hover:shadow-xs active:scale-[0.98]"
                          >
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span>查看详情</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSyncTradeForNewFund(item.code, item.name)}
                            className="flex items-center justify-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-2 rounded-xl text-xs font-black text-white shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            <Plus className="w-3.5 h-3.5 text-blue-200" />
                            <span>添加买入</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 移动端：紧凑列表展示 */}
                <div className="flex flex-col gap-3 md:hidden">
                  {displayResults.map(item => {
                    const quote = searchQuotes[item.code];
                    const isExisting = funds.some(f => String(f.code || '').trim() === item.code);
                    
                    const lastValue = quote?.lastNetValue || 0;
                    const estimatedValue = quote?.estimatedNetValue || 0;
                    const displayValue = estimatedValue > 0 ? estimatedValue : (lastValue > 0 ? lastValue : null);
                    const dailyRate = quote?.dailyRate || 0;
                    
                    const rateColorClass = dailyRate > 0 
                      ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
                      : dailyRate < 0 
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-100/60' 
                        : 'text-slate-500 bg-slate-50 border-slate-150';

                    return (
                      <div 
                        key={item.code} 
                        onClick={() => handleOpenFundDetail({ code: item.code, name: item.name })}
                        className="flex items-center justify-between p-3.5 bg-gradient-to-r from-white to-slate-50/40 border border-slate-200/60 rounded-xl hover:bg-slate-50 active:bg-slate-100/80 transition-all cursor-pointer shadow-2xs relative overflow-hidden"
                      >
                        <div className="flex-1 min-w-0 pr-3 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-slate-800 text-[14px] leading-snug line-clamp-2 pr-1" title={item.name}>
                              {item.name}
                            </h4>
                            {isExisting && (
                              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black bg-emerald-500 text-white leading-none scale-90 origin-left">已持仓</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-mono tracking-wider leading-none scale-95 origin-left shrink-0 whitespace-nowrap">{item.code}</span>
                            <span className="text-[9.5px] font-bold text-slate-400 bg-slate-100 border border-slate-200/40 px-1.5 py-0.5 rounded leading-none scale-95 origin-left shrink-0 whitespace-nowrap">{item.category || '公募基金'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1 min-w-[65px] shrink-0">
                            <div className={`inline-flex items-center justify-center px-2 py-1 border rounded-lg font-mono font-bold text-[11px] min-w-[65px] text-center leading-none ${rateColorClass}`}>
                              {dailyRate > 0 ? '+' : ''}{dailyRate.toFixed(2)}%
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 font-semibold leading-none mt-1 whitespace-nowrap shrink-0">
                              {displayValue !== null ? displayValue.toFixed(4) : '--'}
                              <span className="text-[8.5px] text-slate-400 ml-0.5 scale-90 inline-block font-sans font-medium">
                                {quote?.quoteSource === 'estimate' ? '估' : '实'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSyncTradeForNewFund(item.code, item.name);
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-700 active:to-indigo-700 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xs hover:shadow-xs active:scale-[0.88] transition-all cursor-pointer shrink-0"
                            title="添加买入交易"
                          >
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* ================= 未搜索状态展示：市场全局视角看板 ================= */
            selectedMarketSector === 'all' ? renderRankingsView() : renderSectorGridView()
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 gap-6 h-full">
        
        {/* --- 移动端特化：极简顶部状态条 --- */}
        <div className="md:hidden flex flex-col gap-2.5 px-1 py-1.5 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner scale-95 origin-left">
              <button
                type="button"
                onClick={() => setActiveTab('portfolio')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${activeTab === 'portfolio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
              >
                自选持仓
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${activeTab === 'search' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
              >
                查找基金
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('market')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${activeTab === 'market' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
              >
                全球股市
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1.5 rounded-full select-none border border-slate-200/55 shadow-sm leading-none">
                {lastUpdateTime ? `${lastUpdateTime.slice(-8)}` : '已更新'}
              </span>
            </div>
          </div>
          {activeTab === 'portfolio' && (
            <div className="flex items-center justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white px-4 py-3 rounded-2xl shadow-md border border-slate-700/25 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">总资产 (元)</span>
                <span className="text-lg font-black font-mono mt-0.5">{formatCurrencyAmount(totalAmount)}</span>
              </div>
              <div className="flex flex-col items-end relative z-10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{dailySummaryLabel.replace(' (元)', '')}</span>
                <span className="text-lg font-black font-mono mt-0.5">
                  <FormatNumber value={totalDailyProfit} isCurrency={true} />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* --- 桌面端 Header 与 核心指标 --- */}
        <header className="hidden md:flex flex-shrink-0 flex-col lg:flex-row justify-between items-start lg:items-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl shadow-xl border border-slate-700/40 text-white relative overflow-hidden">
          {/* Subtle micro-lighting effect */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-0 pointer-events-none"></div>
          <div className="absolute bottom-0 left-20 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
              {totalDailyProfit > 0 ? (
                <TrendingUp className="text-rose-400 w-8 h-8 filter drop-shadow-[0_2px_8px_rgba(251,113,133,0.3)] animate-pulse" />
              ) : totalDailyProfit < 0 ? (
                <TrendingDown className="text-emerald-400 w-8 h-8 filter drop-shadow-[0_2px_8px_rgba(52,211,153,0.3)] animate-pulse" />
              ) : (
                <TrendingUp className="text-slate-400 w-8 h-8 filter drop-shadow-[0_2px_8px_rgba(148,163,184,0.3)] animate-pulse" />
              )}
              <span>智能基金追踪</span> 
              <span className="text-[10px] md:text-xs font-bold text-slate-350 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700 select-none">PRO V1.5.0</span>
              
              {/* 桌面端特化：嵌入式毛玻璃 Tab 切换器 */}
              <div className="hidden md:inline-flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15 shrink-0 ml-6 backdrop-blur-md shadow-inner select-none">
                <button
                  type="button"
                  onClick={() => setActiveTab('portfolio')}
                  className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg font-extrabold text-[11px] tracking-tight transition-all duration-200 ${activeTab === 'portfolio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
                >
                  <Wallet className="w-3 h-3" />
                  <span>我的持仓</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg font-extrabold text-[11px] tracking-tight transition-all duration-200 ${activeTab === 'search' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
                >
                  <Search className="w-3 h-3" />
                  <span>查找基金</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('market')}
                  className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg font-extrabold text-[11px] tracking-tight transition-all duration-200 ${activeTab === 'market' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
                >
                  <Globe className="w-3 h-3" />
                  <span>全球股市</span>
                </button>
              </div>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <p className="text-slate-400 text-xs md:text-sm">全天候精准追踪您的基金组合与盘中实时估值</p>
              {!isAuthenticated ? (
                <span className="flex items-center gap-1 text-[10px] md:text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 backdrop-blur-md shadow-sm" title="数据仅保存在当前浏览器本地，多个设备间不会同步">
                  <AlertCircle className="w-3.5 h-3.5" /> 免登录本地模式
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] md:text-[11px] font-bold text-emerald-350 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-sm" title={`云端数据库连接成功，支持多端数据同步: ${user?.email}`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-450" /> 云端同步模式
                </span>
              )}
              {updateBadgeText && (
                <span className="flex items-center gap-1 text-[10px] md:text-[11px] font-semibold text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 backdrop-blur-md">
                  <Clock className="w-3.5 h-3.5 animate-spin-slow" /> {updateBadgeText}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:flex lg:flex-row gap-4 lg:gap-10 mt-5 lg:mt-0 relative z-10 w-full lg:w-auto">
            <div className="flex flex-col items-start lg:items-end flex-shrink-0">
              <span className="text-slate-400 text-[10px] md:text-xs mb-1 font-medium tracking-wide uppercase whitespace-nowrap">总资产金额 (元)</span>
              <span className="text-xl md:text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight whitespace-nowrap">
                {formatCurrencyAmount(totalAmount)}{hasIncompleteAmount && <span className="ml-1 text-amber-400/70 text-base font-medium cursor-help" title="部分基金数据加载中，此处为已更新基金资产之和">*</span>}
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-700/60 h-12 self-center"></div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-slate-400 text-[10px] md:text-xs mb-1 font-medium tracking-wide uppercase whitespace-nowrap">{dailySummaryLabel}</span>
              <span className="text-xl md:text-2xl lg:text-4xl font-black font-mono filter drop-shadow-sm whitespace-nowrap">
                <FormatNumber value={totalDailyProfit} isCurrency={true} />{hasIncompleteDaily && <span className="ml-1 text-amber-400/70 text-lg font-medium cursor-help" title="部分基金数据加载中，此处为已更新基金收益之和">*</span>}
              </span>
            </div>
          </div>
        </header>

        {activeTab === 'portfolio' ? (
          <>
            {/* --- 工具栏 --- */}
            <div className="hidden md:flex flex-shrink-0 items-center justify-between gap-2 bg-white p-2.5 md:px-5 md:py-3 rounded-2xl shadow-sm border border-slate-200/50 relative">
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 pr-2">
                <button type="button" onClick={handleOpenFundModal} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm shadow-sm hover:shadow-md shrink-0 justify-center">
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增持仓</span>
                </button>
                <button type="button" onClick={handleOpenCreateGroup} className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm border border-indigo-200 shadow-sm hover:shadow-md shrink-0 justify-center">
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>创建分组</span>
                </button>
                <button type="button" onClick={() => openModal('sync')} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm border border-slate-200 shadow-sm hover:shadow-md shrink-0 justify-center">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>同步交易</span>
                </button>
                <button type="button" onClick={() => openModal('ocr')} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm border border-slate-200 shadow-sm hover:shadow-md shrink-0 justify-center">
                  <Camera className="w-3.5 h-3.5 text-slate-500" />
                  <span>截图同步</span>
                </button>
                <button type="button" onClick={handleRefresh} disabled={funds.length === 0} className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] hover:-translate-y-[1px] active:scale-[0.99] active:translate-y-0 shadow-sm hover:shadow-md shrink-0 justify-center">
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                  <span>{refreshButtonLabel}</span>
                </button>
              </div>
              
              <div className="relative group shrink-0 border-l border-slate-200 pl-2">
                <button 
                  type="button" 
                  onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl font-bold transition-all duration-200 text-xs md:text-sm border border-slate-200 shadow-sm hover:shadow-md cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:rotate-45 transition-transform duration-300" />
                  <span className="hidden xs:inline">工具与设置</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:rotate-180 transition-transform duration-200" />
                </button>
                
                {/* Hover/Toggle Panel */}
                <div className={`absolute right-0 top-full pt-2 z-30 w-72 ${settingsDropdownOpen ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}>
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100 pb-2 flex justify-between items-center">
                      <span>工具与参数配置</span>
                      {!isAuthenticated ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-amber-50 text-amber-600 border border-amber-200/50">免登录本地版</span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/50">云端已同步</span>
                      )}
                    </div>
                    
                    {/* 数据源 */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-600">数据源</span>
                      <select
                        value={selectedDataSource}
                        onChange={(e) => setSelectedDataSource(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-inner hover:border-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="auto">智能双阶段 (推荐)</option>
                        <option value="tiantian">实时估值优先</option>
                        <option value="eastmoney">收盘净值优先</option>
                      </select>
                      <span className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 p-1.5 rounded-md border border-slate-100">{valuationSourceHint || '自动识别净值更新状态'}</span>
                    </div>

                    {/* 显示页签金额 */}
                    <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs text-slate-600 gap-2 cursor-pointer hover:bg-slate-100/70 transition-all select-none">
                      <span className="font-bold text-slate-600">显示页签金额</span>
                      <input
                        type="checkbox"
                        checked={showTabProfit}
                        onChange={(e) => setShowTabProfit(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>

                    <div className="border-t border-slate-100 my-0.5"></div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={handleOpenImportModal} className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-semibold transition-all duration-150 text-xs border border-slate-200 shadow-sm">
                        <Upload className="w-3.5 h-3.5 text-slate-500" /> 导入配置
                      </button>
                      <button type="button" onClick={() => openModal('export')} className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-semibold transition-all duration-150 text-xs border border-slate-200 shadow-sm">
                        <Download className="w-3.5 h-3.5 text-slate-500" /> 导出数据
                      </button>
                    </div>

                    <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-lg font-bold transition-all duration-150 text-xs border border-rose-200/60 shadow-sm w-full mt-1">
                      <LogOut className="w-3.5 h-3.5" /> 退出系统登录
                    </button>
                  </div>
                </div>
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
              handleOpenSyncTrade={handleOpenSyncTrade}
              todayStr={todayStr}
            />
          </>
        ) : activeTab === 'market' ? (
          <GlobalMarketPanel />
        ) : (
          renderSearchTab()
        )}

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
        /* Mobile Touch & Safe Area Enhancements */
        button, select, input, a, [role="button"] {
          touch-action: manipulation;
        }
        .custom-scrollbar {
          -webkit-overflow-scrolling: touch;
        }
        #root {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        /* Hide scrollbars for horizontal tab wrappers on mobile */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
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
        sectors={sectors}
        funds={funds}
      />

      <OcrSyncModal
        isOpen={modals.ocr}
        onClose={() => closeModal('ocr')}
        funds={funds}
        onConfirmImport={handleBatchOcrSync}
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
        dailyProfitsCount={dailyProfits.length}
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

      <SyncModal
        isOpen={showSyncModal}
        onClose={handleLogout}
        onMerge={handleMergeToCloud}
        onOverwrite={handleOverwriteWithCloud}
        syncStatus={syncStatus}
        localFundsCount={localDataStats.fundsCount}
        localTxsCount={localDataStats.txsCount}
      />

      {/* --- 移动端底部毛玻璃悬浮 Dock --- */}
      {activeTab === 'portfolio' && (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[80%] max-w-[260px]">
          {/* Settings Popover (Floating above dock) */}
          {settingsDropdownOpen && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-72 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 p-5 z-50 animate-in slide-in-from-bottom-5 duration-300 ease-out">
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-100/60 pb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <span>控制与设置中心</span>
                  {!isAuthenticated ? (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-amber-50 text-amber-600 border border-amber-200/50">免登录</span>
                  ) : (
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/50">已同步</span>
                  )}
                </span>
                <button type="button" onClick={() => setSettingsDropdownOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100/80 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* 数据源 */}
              <div className="flex flex-col gap-1.5 mt-3.5">
                <span className="text-xs font-bold text-slate-600">数据源</span>
                <select
                  value={selectedDataSource}
                  onChange={(e) => setSelectedDataSource(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="auto">智能双阶段 (推荐)</option>
                  <option value="tiantian">实时估值优先</option>
                  <option value="eastmoney">收盘净值优先</option>
                </select>
                <span className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50/50 p-1.5 rounded-md border border-slate-100/50">{valuationSourceHint || '自动识别净值更新状态'}</span>
              </div>

              {/* 显示页签金额 */}
              <label className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-xs text-slate-600 gap-2 cursor-pointer hover:bg-slate-100/70 transition-all select-none mt-3">
                <span className="font-bold text-slate-600">显示页签金额</span>
                <input
                  type="checkbox"
                  checked={showTabProfit}
                  onChange={(e) => setShowTabProfit(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              {/* 高级操作 */}
              <div className="flex flex-col gap-1.5 mt-3.5">
                <span className="text-xs font-bold text-slate-600">高级功能</span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setSettingsDropdownOpen(false); openModal('sync'); }} className="flex items-center justify-center gap-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 py-1.5 rounded-lg font-semibold text-xs border border-indigo-100 shadow-sm active:scale-95 transition-all">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" /> 同步交易
                  </button>
                  <button type="button" onClick={() => { setSettingsDropdownOpen(false); openModal('ocr'); }} className="flex items-center justify-center gap-1 bg-slate-100/80 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg font-semibold text-xs border border-slate-200 shadow-sm active:scale-95 transition-all">
                    <Camera className="w-3.5 h-3.5 text-slate-500" /> 截图识别
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100/80 my-3.5"></div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setSettingsDropdownOpen(false); handleOpenImportModal(); }} className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-600 py-1.5 rounded-lg font-semibold text-xs border border-slate-200 shadow-sm active:scale-95 transition-all">
                  <Upload className="w-3.5 h-3.5 text-slate-500" /> 导入配置
                </button>
                <button type="button" onClick={() => { setSettingsDropdownOpen(false); openModal('export'); }} className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-600 py-1.5 rounded-lg font-semibold text-xs border border-slate-200 shadow-sm active:scale-95 transition-all">
                  <Download className="w-3.5 h-3.5 text-slate-500" /> 导出数据
                </button>
              </div>

              <button type="button" onClick={() => { setSettingsDropdownOpen(false); handleLogout(); }} className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-lg font-bold transition-all duration-150 text-xs border border-rose-200/60 shadow-sm w-full mt-2 active:scale-98">
                <LogOut className="w-3.5 h-3.5" /> 退出系统登录
              </button>
            </div>
          )}

          {/* Dock Main Bar: Premium Frosted Glass */}
          <div className="backdrop-blur-2xl bg-white/70 border border-white/50 shadow-[0_10px_35px_rgba(0,0,0,0.1)] rounded-full px-2 flex items-center justify-around text-slate-700 h-12 relative">
            {/* 新增持仓 */}
            <button 
              type="button" 
              onClick={handleOpenFundModal}
              className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-indigo-600 active:scale-90 transition-all duration-200 cursor-pointer rounded-full active:bg-slate-100/50 shrink-0"
              title="新增持仓"
            >
              <Plus className="w-4.5 h-4.5" />
            </button>

            {/* 创建分组 */}
            <button 
              type="button" 
              onClick={handleOpenCreateGroup}
              className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-indigo-600 active:scale-90 transition-all duration-200 cursor-pointer rounded-full active:bg-slate-100/50 shrink-0"
              title="创建分组"
            >
              <FolderPlus className="w-4.5 h-4.5" />
            </button>

            {/* 一键刷新 */}
            <button 
              type="button" 
              onClick={handleRefresh}
              disabled={funds.length === 0}
              className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-indigo-600 active:scale-90 transition-all duration-200 cursor-pointer rounded-full active:bg-slate-100/50 shrink-0"
              title="刷新数据"
            >
              <RefreshCw className={`w-4.5 h-4.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            </button>

            {/* 同步交易 */}
            <button 
              type="button" 
              onClick={() => openModal('sync')}
              className="flex items-center justify-center w-9 h-9 text-slate-500 hover:text-indigo-600 active:scale-90 transition-all duration-200 cursor-pointer rounded-full active:bg-slate-100/50 shrink-0"
              title="同步交易"
            >
              <ArrowRightLeft className="w-4.5 h-4.5" />
            </button>

            {/* 工具与设置 */}
            <button 
              type="button" 
              onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
              className={`flex items-center justify-center w-9 h-9 transition-all duration-200 cursor-pointer rounded-full active:scale-90 shrink-0 ${settingsDropdownOpen ? 'text-indigo-600 bg-slate-100/80 shadow-inner' : 'text-slate-500 hover:text-indigo-600 active:bg-slate-100/50'}`}
              title="工具与设置"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
