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
  Clock
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
const DEFAULT_DATA_SOURCE = 'tiantian';

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
  const currentShares = Math.max(0, toNumber(normalizedFund.shares) || deriveSharesFromDisplayedAmount(normalizedFund) || 0);
  const tradeImpact = buildTradeImpact({
    fund: normalizedFund,
    trade,
    referenceNetValue,
    currentShares,
    currentCostAmount: Math.max(0, toNumber(normalizedFund.costAmount)),
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
  const [syncForm, setSyncForm] = useState({ code: '', type: '买入', amount: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', code: '', sector: '', amount: '' });
  const [importState, setImportState] = useState({
    fileName: '',
    error: '',
    preview: null,
    payload: null,
    mode: 'replace-all',
    isParsing: false,
  });

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
    const referenceNetValue = getDisplayedReferenceNetValue(tradeReferenceFund);

    if (referenceNetValue <= 0) {
      alert('暂时无法获取这只基金的可用净值，无法按份额口径同步交易，请先刷新数据后再试。');
      return;
    }

    const tradePayload = {
      type: syncForm.type,
      amount: syncForm.amount,
    };
    const currentShares = Math.max(0, toNumber(tradeReferenceFund.shares) || deriveSharesFromDisplayedAmount(tradeReferenceFund) || 0);
    const tradeImpact = buildTradeImpact({
      fund: tradeReferenceFund,
      trade: tradePayload,
      referenceNetValue,
      currentShares,
      currentCostAmount: Math.max(0, toNumber(tradeReferenceFund.costAmount)),
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

      return applyTradeToFund(fund, tradePayload, quote);
    }));
    if (transactionRecord) {
      setTransactions((currentTransactions) => sortTransactionsByDateDesc([...currentTransactions, transactionRecord]));
    }

    closeModal('sync');
    setSyncForm({ code: '', type: '买入', amount: '' });
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
            <button type="button" onClick={handleOpenCreateGroup} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-indigo-200">
              <FolderPlus className="w-4 h-4" /> 创建分组
            </button>
            <button type="button" onClick={() => openModal('sync')} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <ArrowRightLeft className="w-4 h-4" /> 同步交易
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 gap-3">
              <span className="font-medium text-slate-700">数据源</span>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tiantian">天天基金</option>
                <option value="eastmoney">东财官方</option>
              </select>
              <span className="text-slate-400">{valuationSourceHint || '按所选数据源展示'}</span>
            </div>
            <button type="button" onClick={handleOpenImportModal} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
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
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .add-fund-number-input::-webkit-outer-spin-button,
        .add-fund-number-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .add-fund-number-input { appearance: textfield; -moz-appearance: textfield; }
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
        hasHoldingSharesInput={hasHoldingSharesInput}
        isHoldingSharesValid={isHoldingSharesValid}
        hasHoldingAmountInput={hasHoldingAmountInput}
        hasHoldingProfitInput={hasHoldingProfitInput}
        isDerivedCostAmountValid={isDerivedCostAmountValid}
        derivedCostAmount={derivedCostAmount}
        canSubmitFund={canSubmitFund}
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
