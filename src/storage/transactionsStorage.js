export const TRANSACTION_STORAGE_VERSION = 1;
export const TRANSACTION_STORAGE_KEY = 'fundTrackerTransactionsV1';

const ALLOWED_TRANSACTION_TYPES = new Set(['买入', '卖出', '分红']);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTransactionEntry = (entry, index = 0) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const normalizedType = typeof entry.type === 'string' ? entry.type.trim() : '';
  if (!ALLOWED_TRANSACTION_TYPES.has(normalizedType)) {
    return null;
  }

  const fundCode = String(entry.fundCode || '').trim();
  if (!fundCode) {
    return null;
  }

  const amount = Math.max(0, toNumber(entry.amount));
  if (amount <= 0) {
    return null;
  }

  const normalizedTradeDate = typeof entry.tradeDate === 'string' && entry.tradeDate.trim()
    ? entry.tradeDate.trim()
    : '';

  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `tx_legacy_${index}_${Date.now()}`,
    fundCode,
    fundName: typeof entry.fundName === 'string' ? entry.fundName.trim() : '',
    fundId: Number.isFinite(entry.fundId) ? entry.fundId : null,
    type: normalizedType,
    amount,
    tradeDate: normalizedTradeDate,
    referenceNetValue: toNullableNumber(entry.referenceNetValue),
    sharesDelta: toNullableNumber(entry.sharesDelta),
    costDelta: toNullableNumber(entry.costDelta),
    source: typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : 'manual-sync',
    note: typeof entry.note === 'string' ? entry.note : '',
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
  };
};

export const createEmptyTransactionStore = () => ({
  version: TRANSACTION_STORAGE_VERSION,
  entries: [],
});

export const normalizeStoredTransactionStore = (storedValue) => {
  if (!storedValue) {
    return createEmptyTransactionStore();
  }

  const rawEntries = Array.isArray(storedValue)
    ? storedValue
    : Array.isArray(storedValue.entries)
      ? storedValue.entries
      : [];

  const entries = rawEntries
    .map((entry, index) => normalizeTransactionEntry(entry, index))
    .filter(Boolean);

  return {
    version: TRANSACTION_STORAGE_VERSION,
    entries,
  };
};

export const buildStoredTransactionPayload = (transactions) => ({
  version: TRANSACTION_STORAGE_VERSION,
  entries: normalizeStoredTransactionStore(transactions).entries,
});

export const loadTransactions = () => {
  try {
    const rawValue = localStorage.getItem(TRANSACTION_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return normalizeStoredTransactionStore(parsedValue).entries;
  } catch (error) {
    console.warn(`交易流水缓存解析失败: ${TRANSACTION_STORAGE_KEY}`, error);
    return [];
  }
};

export const saveTransactions = (transactions) => {
  const payload = buildStoredTransactionPayload({ entries: transactions });
  localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(payload));
};
