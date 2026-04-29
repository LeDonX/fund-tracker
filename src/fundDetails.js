const DETAIL_CACHE_VERSION = 1;
const DETAIL_CACHE_STORAGE_KEY = 'fundTrackerDetailCacheV1';
const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPositiveNumberOrNull = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (value) => {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getIsoDate = (value) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeOfficialHistory = (history) => {
  if (!Array.isArray(history)) return [];

  const deduped = new Map();

  history.forEach((point) => {
    const date = typeof point?.date === 'string' ? point.date.trim() : '';
    const netValue = toPositiveNumberOrNull(point?.netValue);
    const dailyRate = point?.dailyRate === undefined ? null : Number.parseFloat(point.dailyRate);

    if (!date || netValue === null) {
      return;
    }

    deduped.set(date, {
      date,
      netValue,
      dailyRate: Number.isFinite(dailyRate) ? dailyRate : null,
    });
  });

  return [...deduped.values()].sort((left, right) => right.date.localeCompare(left.date));
};

const mergeOfficialHistory = (...histories) => {
  return normalizeOfficialHistory(histories.flatMap((history) => (Array.isArray(history) ? history : [])));
};

const normalizeRemoteThemes = (themes) => {
  if (!Array.isArray(themes)) return [];

  return [...new Set(
    themes
      .map((theme) => (typeof theme === 'string' ? theme.trim() : ''))
      .filter(Boolean),
  )];
};

export const createEmptyDetailCacheStore = () => ({
  version: DETAIL_CACHE_VERSION,
  entries: {},
});

export const normalizeStoredDetailCacheStore = (storedValue) => {
  if (!storedValue || typeof storedValue !== 'object') {
    return createEmptyDetailCacheStore();
  }

  const rawEntries = storedValue.version === DETAIL_CACHE_VERSION && storedValue.entries && typeof storedValue.entries === 'object'
    ? storedValue.entries
    : (storedValue.entries && typeof storedValue.entries === 'object' ? storedValue.entries : storedValue);

  const entries = Object.fromEntries(
    Object.entries(rawEntries)
      .map(([code, entry]) => {
        const normalizedCode = String(code || '').trim();
        if (!normalizedCode || !entry || typeof entry !== 'object') {
          return null;
        }

        return [normalizedCode, {
          code: normalizedCode,
          fetchedAt: Number.isFinite(entry.fetchedAt) ? entry.fetchedAt : 0,
          quote: {
            estimatedNetValue: toPositiveNumberOrNull(entry.quote?.estimatedNetValue),
            lastNetValue: toPositiveNumberOrNull(entry.quote?.lastNetValue),
            updateTime: typeof entry.quote?.updateTime === 'string' ? entry.quote.updateTime : '',
            netValueDate: typeof entry.quote?.netValueDate === 'string' ? entry.quote.netValueDate : '',
          },
          officialHistory: normalizeOfficialHistory(entry.officialHistory),
          remoteThemes: normalizeRemoteThemes(entry.remoteThemes),
        }];
      })
      .filter(Boolean),
  );

  return {
    version: DETAIL_CACHE_VERSION,
    entries,
  };
};

export const buildStoredDetailCachePayload = (entries) => ({
  version: DETAIL_CACHE_VERSION,
  entries,
});

export const buildDetailCacheEntry = ({ code, quote, officialHistory, remoteThemes }) => ({
  code: String(code || '').trim(),
  fetchedAt: Date.now(),
  quote: {
    estimatedNetValue: toPositiveNumberOrNull(quote?.estimatedNetValue),
    lastNetValue: toPositiveNumberOrNull(quote?.lastNetValue),
    updateTime: typeof quote?.updateTime === 'string' ? quote.updateTime : '',
    netValueDate: typeof quote?.netValueDate === 'string' ? quote.netValueDate : '',
  },
  officialHistory: normalizeOfficialHistory(officialHistory),
  remoteThemes: normalizeRemoteThemes(remoteThemes),
});

export const isDetailCacheStale = (entry, now = Date.now()) => {
  if (!entry?.fetchedAt) return true;
  return now - entry.fetchedAt > DETAIL_CACHE_TTL_MS;
};

const buildOfficialHistoryFromSources = (sourceFund, detailEntry) => {
  const fallbackHistory = [];

  if (toPositiveNumberOrNull(sourceFund?.officialCurrentNetValue) && sourceFund?.officialNetValueDate) {
    fallbackHistory.push({
      date: sourceFund.officialNetValueDate,
      netValue: toNumber(sourceFund.officialCurrentNetValue),
      dailyRate: Number.isFinite(sourceFund?.officialDailyRate) ? Number.parseFloat(sourceFund.officialDailyRate) : null,
    });
  }

  if (toPositiveNumberOrNull(sourceFund?.officialLastNetValue) && sourceFund?.officialPreviousNetValueDate) {
    fallbackHistory.push({
      date: sourceFund.officialPreviousNetValueDate,
      netValue: toNumber(sourceFund.officialLastNetValue),
      dailyRate: null,
    });
  }

  return mergeOfficialHistory(detailEntry?.officialHistory, fallbackHistory);
};

const getOfficialPoint = (history, index) => (Array.isArray(history) && history[index] ? history[index] : null);

const getHistoryPointOnOrBefore = (history, targetDate) => {
  if (!Array.isArray(history) || history.length === 0) return null;

  const targetKey = getIsoDate(targetDate);
  return history.find((point) => point.date <= targetKey) ?? null;
};

const buildOfficialPerformance = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      ytd: null,
      oneYear: null,
      threeYear: null,
    };
  }

  const latestPoint = history[0];
  const latestDate = parseDate(latestPoint.date);
  if (!latestDate || !Number.isFinite(latestPoint.netValue) || latestPoint.netValue <= 0) {
    return {
      ytd: null,
      oneYear: null,
      threeYear: null,
    };
  }

  const yearStart = new Date(latestDate.getFullYear(), 0, 1);
  const oneYearTarget = new Date(latestDate);
  oneYearTarget.setFullYear(oneYearTarget.getFullYear() - 1);
  const threeYearTarget = new Date(latestDate);
  threeYearTarget.setFullYear(threeYearTarget.getFullYear() - 3);

  const computeRate = (point) => {
    if (!point || !Number.isFinite(point.netValue) || point.netValue <= 0) return null;
    return ((latestPoint.netValue - point.netValue) / point.netValue) * 100;
  };

  return {
    ytd: computeRate(getHistoryPointOnOrBefore(history, yearStart)),
    oneYear: computeRate(getHistoryPointOnOrBefore(history, oneYearTarget)),
    threeYear: computeRate(getHistoryPointOnOrBefore(history, threeYearTarget)),
  };
};

const resolveQuoteValues = (sourceFund, detailEntry) => {
  const quote = detailEntry?.quote ?? {};

  const sourceQuoteTime = typeof sourceFund?.lastValuationTime === 'string' ? sourceFund.lastValuationTime : '';
  const cacheQuoteTime = typeof quote.updateTime === 'string' ? quote.updateTime : '';
  const sourceQuoteDate = typeof sourceFund?.netValueDate === 'string' ? sourceFund.netValueDate : '';
  const cacheQuoteDate = typeof quote.netValueDate === 'string' ? quote.netValueDate : '';
  const shouldPreferSourceQuote = Boolean(
    !cacheQuoteDate
    || (sourceQuoteDate && sourceQuoteDate > cacheQuoteDate)
    || (sourceQuoteDate && sourceQuoteDate === cacheQuoteDate && sourceQuoteTime && sourceQuoteTime >= cacheQuoteTime)
  );

  const preferredEstimatedValue = shouldPreferSourceQuote && sourceFund?.quoteSource === 'estimate'
    ? toPositiveNumberOrNull(sourceFund?.currentNetValue)
    : null;
  const preferredLastValue = shouldPreferSourceQuote
    ? (toPositiveNumberOrNull(sourceFund?.lastNetValue)
      ?? (sourceFund?.quoteSource === 'quote' ? toPositiveNumberOrNull(sourceFund?.currentNetValue) : null))
    : null;

  const estimatedNetValue = preferredEstimatedValue
    ?? toPositiveNumberOrNull(quote.estimatedNetValue)
    ?? (sourceFund?.quoteSource === 'estimate' ? toPositiveNumberOrNull(sourceFund?.currentNetValue) : null);

  const lastNetValue = preferredLastValue
    ?? toPositiveNumberOrNull(quote.lastNetValue)
    ?? toPositiveNumberOrNull(sourceFund?.lastNetValue)
    ?? (sourceFund?.quoteSource === 'quote' ? toPositiveNumberOrNull(sourceFund?.currentNetValue) : null);

  return {
    estimatedNetValue,
    lastNetValue,
    updateTime: shouldPreferSourceQuote && sourceQuoteTime
      ? sourceQuoteTime
      : (typeof quote.updateTime === 'string' && quote.updateTime ? quote.updateTime : sourceQuoteTime),
    netValueDate: shouldPreferSourceQuote && sourceQuoteDate
      ? sourceQuoteDate
      : (typeof quote.netValueDate === 'string' && quote.netValueDate ? quote.netValueDate : sourceQuoteDate),
  };
};

const getTotalCostAmount = (sourceFund, displayedFund, holdingAmount) => {
  const sourceCostAmount = Number.parseFloat(sourceFund?.costAmount);
  if (Number.isFinite(sourceCostAmount) && sourceCostAmount >= 0) {
    return sourceCostAmount;
  }

  if (Number.isFinite(holdingAmount) && Number.isFinite(displayedFund?.totalProfit)) {
    return Math.max(0, holdingAmount - Number.parseFloat(displayedFund.totalProfit));
  }

  return null;
};

const getHoldingDays = (sourceFund) => {
  if (!sourceFund?.holdingStartDate) return null;

  const startDate = parseDate(sourceFund.holdingStartDate);
  if (!startDate) return null;

  const today = startOfDay(new Date());
  const diffMs = today.getTime() - startOfDay(startDate).getTime();
  if (diffMs < 0) return null;

  return Math.floor(diffMs / MS_PER_DAY);
};

export const buildFundDetailModel = ({
  sourceFund,
  displayedFund,
  totalPortfolioAmount,
  detailEntry,
}) => {
  if (!sourceFund || !displayedFund) {
    return null;
  }

  const code = String(sourceFund.code || displayedFund.code || '').trim();
  const holdingAmount = Number.isFinite(displayedFund.amount) ? Number.parseFloat(displayedFund.amount) : null;
  const shares = toPositiveNumberOrNull(sourceFund.shares) ?? toPositiveNumberOrNull(displayedFund.shares);
  const totalCostAmount = getTotalCostAmount(sourceFund, displayedFund, holdingAmount);
  const holdingProfit = Number.isFinite(holdingAmount) && Number.isFinite(totalCostAmount)
    ? holdingAmount - totalCostAmount
    : (Number.isFinite(displayedFund.totalProfit) ? Number.parseFloat(displayedFund.totalProfit) : null);
  const holdingProfitRate = Number.isFinite(holdingProfit) && Number.isFinite(totalCostAmount) && totalCostAmount > 0
    ? (holdingProfit / totalCostAmount) * 100
    : (Number.isFinite(displayedFund.totalRate) ? Number.parseFloat(displayedFund.totalRate) : null);
  const holdingRatio = Number.isFinite(holdingAmount) && Number.isFinite(totalPortfolioAmount) && totalPortfolioAmount > 0
    ? (holdingAmount / totalPortfolioAmount) * 100
    : null;
  const unitCost = Number.isFinite(totalCostAmount) && Number.isFinite(shares) && shares > 0
    ? totalCostAmount / shares
    : null;
  const officialHistory = buildOfficialHistoryFromSources(sourceFund, detailEntry);
  const latestOfficialPoint = getOfficialPoint(officialHistory, 0);
  const previousOfficialPoint = getOfficialPoint(officialHistory, 1);
  const officialPerformance = buildOfficialPerformance(officialHistory);
  const quoteValues = resolveQuoteValues(sourceFund, detailEntry);
  const yesterdayProfit = Number.isFinite(shares)
    && shares > 0
    && latestOfficialPoint
    && previousOfficialPoint
    && Number.isFinite(latestOfficialPoint.netValue)
    && Number.isFinite(previousOfficialPoint.netValue)
    ? shares * (latestOfficialPoint.netValue - previousOfficialPoint.netValue)
    : null;
  const latestNetValue = latestOfficialPoint?.netValue ?? quoteValues.lastNetValue ?? null;
  const relatedThemes = detailEntry?.remoteThemes?.length > 0
    ? detailEntry.remoteThemes
    : (sourceFund?.sector ? [sourceFund.sector] : []);
  const holdingDays = getHoldingDays(sourceFund);

  return {
    code,
    name: sourceFund.name || displayedFund.name || '未命名基金',
    valuationSource: displayedFund.valuationSource || 'fallback',
    holdingAmount,
    shares: shares ?? null,
    holdingRatio,
    holdingProfit,
    holdingProfitRate,
    unitCost,
    totalCostAmount,
    dailyProfit: Number.isFinite(displayedFund.dailyProfit) ? Number.parseFloat(displayedFund.dailyProfit) : null,
    yesterdayProfit,
    estimatedNetValue: quoteValues.estimatedNetValue,
    latestNetValue,
    relatedThemes,
    isRelatedThemesFallback: !(detailEntry?.remoteThemes?.length > 0),
    holdingDays,
    holdingStartDate: sourceFund.holdingStartDate || '',
    performance: officialPerformance,
    officialLatestDate: latestOfficialPoint?.date || sourceFund.officialNetValueDate || '',
    officialPreviousDate: previousOfficialPoint?.date || sourceFund.officialPreviousNetValueDate || '',
    quoteUpdateTime: quoteValues.updateTime,
    quoteNetValueDate: quoteValues.netValueDate,
    cacheFetchedAt: detailEntry?.fetchedAt || 0,
  };
};

export {
  DETAIL_CACHE_STORAGE_KEY,
  DETAIL_CACHE_TTL_MS,
  DETAIL_CACHE_VERSION,
};
