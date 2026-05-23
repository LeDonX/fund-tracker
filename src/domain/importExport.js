export const EXPORT_BUNDLE_VERSION = 1;
export const EXPORT_APP_NAME = 'fund-tracker';

const toArray = (value) => (Array.isArray(value) ? value : []);

export const buildExportBundle = ({
  funds,
  sectors,
  detailCache,
  transactions,
  dailyProfits,
}) => ({
  version: EXPORT_BUNDLE_VERSION,
  exportedAt: Date.now(),
  app: EXPORT_APP_NAME,
  data: {
    funds: toArray(funds),
    sectors: toArray(sectors),
    detailCache: detailCache && typeof detailCache === 'object'
      ? detailCache
      : { version: 1, entries: {} },
    transactions: toArray(transactions),
    dailyProfits: toArray(dailyProfits),
  },
});

export const validateImportBundle = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: '导入文件不是有效的 JSON 对象。' };
  }

  if (!payload.data || typeof payload.data !== 'object') {
    return { ok: false, error: '导入文件缺少 data 字段。' };
  }

  if (!Array.isArray(payload.data.funds)) {
    return { ok: false, error: '导入文件中的 funds 必须是数组。' };
  }

  if (!Array.isArray(payload.data.sectors)) {
    return { ok: false, error: '导入文件中的 sectors 必须是数组。' };
  }

  if (payload.data.detailCache !== undefined && (!payload.data.detailCache || typeof payload.data.detailCache !== 'object')) {
    return { ok: false, error: '导入文件中的 detailCache 格式不正确。' };
  }

  if (payload.data.transactions !== undefined && !Array.isArray(payload.data.transactions)) {
    return { ok: false, error: '导入文件中的 transactions 必须是数组。' };
  }

  if (payload.data.dailyProfits !== undefined && !Array.isArray(payload.data.dailyProfits)) {
    return { ok: false, error: '导入文件中的 dailyProfits 必须是数组。' };
  }

  return { ok: true, error: '' };
};

export const buildImportPreview = (payload) => {
  const funds = toArray(payload?.data?.funds);
  const sectors = toArray(payload?.data?.sectors);
  const transactions = toArray(payload?.data?.transactions);
  const dailyProfits = toArray(payload?.data?.dailyProfits);
  const detailCacheEntries = payload?.data?.detailCache?.entries;

  return {
    app: typeof payload?.app === 'string' ? payload.app : '',
    version: Number.isFinite(payload?.version) ? payload.version : null,
    fundsCount: funds.length,
    sectorsCount: sectors.length,
    transactionsCount: transactions.length,
    dailyProfitsCount: dailyProfits.length,
    detailCacheCount: detailCacheEntries && typeof detailCacheEntries === 'object'
      ? Object.keys(detailCacheEntries).length
      : 0,
  };
};

export const mergeImportedFunds = (currentFunds, incomingFunds) => {
  const existingCodes = new Set(
    toArray(currentFunds)
      .map((fund) => String(fund?.code || '').trim())
      .filter(Boolean),
  );

  const additions = toArray(incomingFunds).filter((fund) => {
    const normalizedCode = String(fund?.code || '').trim();
    return normalizedCode && !existingCodes.has(normalizedCode);
  });

  return [...toArray(currentFunds), ...additions];
};

export const mergeStringArrays = (currentValues, incomingValues) => {
  return [...new Set([
    ...toArray(currentValues).map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean),
    ...toArray(incomingValues).map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean),
  ])];
};

export const mergeDetailCacheEntries = (currentEntries, incomingEntries) => ({
  ...(currentEntries && typeof currentEntries === 'object' ? currentEntries : {}),
  ...(incomingEntries && typeof incomingEntries === 'object' ? incomingEntries : {}),
});

export const mergeTransactionsById = (currentTransactions, incomingTransactions) => {
  const merged = [...toArray(currentTransactions)];
  const existingIds = new Set(merged.map((transaction) => String(transaction?.id || '').trim()).filter(Boolean));

  toArray(incomingTransactions).forEach((transaction) => {
    const normalizedId = String(transaction?.id || '').trim();
    if (normalizedId && existingIds.has(normalizedId)) {
      return;
    }

    if (normalizedId) {
      existingIds.add(normalizedId);
    }
    merged.push(transaction);
  });

  return merged;
};

export const mergeDailyProfitsByDateAndCode = (currentProfits, incomingProfits) => {
  const merged = [...toArray(currentProfits)];
  const existingKeys = new Set(
    merged.map((dp) => `${String(dp?.fundCode || '').trim()}_${String(dp?.date || '').trim()}`)
  );

  toArray(incomingProfits).forEach((dp) => {
    const code = String(dp?.fundCode || '').trim();
    const date = String(dp?.date || '').trim();
    const key = `${code}_${date}`;
    if (code && date && existingKeys.has(key)) {
      return;
    }

    if (code && date) {
      existingKeys.add(key);
    }
    merged.push(dp);
  });

  return merged;
};
