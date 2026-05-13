const TRANSACTION_TYPES = new Set(['买入', '卖出', '分红']);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createTransactionId = () => {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const getTodayDateKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildTradeImpact = ({
  fund,
  trade,
  referenceNetValue,
  currentShares,
  currentCostAmount,
  tradeDate = getTodayDateKey(),
}) => {
  const normalizedType = typeof trade?.type === 'string' ? trade.type.trim() : '';
  const tradeAmount = Math.max(0, toNumber(trade?.amount));
  const safeReferenceNetValue = Math.max(0, toNumber(referenceNetValue));
  const safeCurrentShares = Math.max(0, Number.isFinite(currentShares) ? currentShares : toNumber(fund?.shares));
  const safeCurrentCostAmount = Math.max(0, Number.isFinite(currentCostAmount) ? currentCostAmount : toNumber(fund?.costAmount));
  const holdingStartDate = typeof fund?.holdingStartDate === 'string' ? fund.holdingStartDate : '';

  if (!TRANSACTION_TYPES.has(normalizedType) || tradeAmount <= 0 || safeReferenceNetValue <= 0) {
    return null;
  }

  let nextShares = safeCurrentShares;
  let nextCostAmount = safeCurrentCostAmount;

  if (normalizedType === '买入') {
    nextShares += tradeAmount / safeReferenceNetValue;
    nextCostAmount += tradeAmount;
  } else if (normalizedType === '卖出') {
    if (safeCurrentShares <= 0) {
      return null;
    }

    const soldShares = Math.min(safeCurrentShares, tradeAmount / safeReferenceNetValue);
    const soldRatio = safeCurrentShares > 0 ? soldShares / safeCurrentShares : 0;
    nextShares = Math.max(0, safeCurrentShares - soldShares);
    nextCostAmount = Math.max(0, safeCurrentCostAmount - safeCurrentCostAmount * soldRatio);
  } else if (normalizedType === '分红') {
    nextCostAmount = Math.max(0, safeCurrentCostAmount - tradeAmount);
  }

  const normalizedTradeDate = typeof tradeDate === 'string' && tradeDate.trim() ? tradeDate.trim() : getTodayDateKey();
  const nextHoldingStartDate = normalizedType === '买入'
    ? (holdingStartDate || normalizedTradeDate)
    : (normalizedType === '卖出' && nextShares === 0 ? '' : holdingStartDate);

  return {
    type: normalizedType,
    amount: tradeAmount,
    tradeDate: normalizedTradeDate,
    referenceNetValue: safeReferenceNetValue,
    sharesDelta: nextShares - safeCurrentShares,
    costDelta: nextCostAmount - safeCurrentCostAmount,
    nextShares,
    nextCostAmount,
    nextHoldingStartDate,
  };
};

export const buildTransactionRecord = ({
  fund,
  tradeImpact,
  source = 'manual-sync',
  note = '',
}) => {
  if (!fund || !tradeImpact) {
    return null;
  }

  return {
    id: createTransactionId(),
    fundCode: String(fund.code || '').trim(),
    fundName: String(fund.name || '').trim() || '未命名基金',
    fundId: Number.isFinite(fund.id) ? fund.id : null,
    type: tradeImpact.type,
    amount: tradeImpact.amount,
    tradeDate: tradeImpact.tradeDate,
    referenceNetValue: toNullableNumber(tradeImpact.referenceNetValue),
    sharesDelta: toNullableNumber(tradeImpact.sharesDelta),
    costDelta: toNullableNumber(tradeImpact.costDelta),
    source,
    note: typeof note === 'string' ? note : '',
    createdAt: Date.now(),
  };
};

export const filterTransactionsByFundCode = (transactions, fundCode) => {
  const normalizedCode = String(fundCode || '').trim();
  if (!normalizedCode || !Array.isArray(transactions)) {
    return [];
  }

  return transactions.filter((transaction) => String(transaction?.fundCode || '').trim() === normalizedCode);
};

export const sortTransactionsByDateDesc = (transactions) => {
  if (!Array.isArray(transactions)) {
    return [];
  }

  return [...transactions].sort((left, right) => {
    const leftTradeDate = typeof left?.tradeDate === 'string' ? left.tradeDate : '';
    const rightTradeDate = typeof right?.tradeDate === 'string' ? right.tradeDate : '';

    if (leftTradeDate !== rightTradeDate) {
      return rightTradeDate.localeCompare(leftTradeDate);
    }

    const leftCreatedAt = Number.isFinite(left?.createdAt) ? left.createdAt : 0;
    const rightCreatedAt = Number.isFinite(right?.createdAt) ? right.createdAt : 0;
    return rightCreatedAt - leftCreatedAt;
  });
};
