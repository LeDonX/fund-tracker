const TRANSACTION_TYPES = new Set(['买入', '卖出', '分红', '红利再投']);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundAmount = (v) => {
  if (v === undefined || v === null || Number.isNaN(v)) return v;
  const num = Number.parseFloat(v);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : num;
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
  const safeReferenceNetValue = Math.max(0, toNumber(referenceNetValue));
  const safeCurrentShares = Math.max(0, Number.isFinite(currentShares) ? currentShares : toNumber(fund?.shares));
  const safeCurrentCostAmount = Math.max(0, Number.isFinite(currentCostAmount) ? currentCostAmount : toNumber(fund?.costAmount));
  const holdingStartDate = typeof fund?.holdingStartDate === 'string' ? fund.holdingStartDate : '';

  if (!TRANSACTION_TYPES.has(normalizedType) || safeReferenceNetValue <= 0) {
    return null;
  }

  let tradeAmount = 0;
  let tradeShares = 0;
  const safeFee = roundAmount(Math.max(0, toNumber(trade?.fee)));

  if (trade?.volumeType === 'shares') {
    // 交易份额口径
    tradeShares = Math.max(0, toNumber(trade?.shares));
    // 如果用户同时也输入了可选的发生本金，优先使用真实本金，否则通过净值折算
    const optAmount = toNumber(trade?.amount);
    tradeAmount = roundAmount(optAmount > 0 ? optAmount : tradeShares * safeReferenceNetValue);
  } else if (trade?.volumeType === 'amount') {
    // 确认金额口径
    tradeAmount = roundAmount(Math.max(0, toNumber(trade?.amount)));
    // 如果用户同时也输入了可选的交易份额，优先使用真实份额，否则通过净值折算
    const optShares = toNumber(trade?.shares);
    if (optShares > 0) {
      tradeShares = optShares;
    } else {
      const netAmount = normalizedType === '买入' ? Math.max(0, tradeAmount - safeFee) : tradeAmount;
      tradeShares = netAmount / safeReferenceNetValue;
    }
  } else {
    // 兜底支持旧数据格式
    if (trade?.shares !== undefined && toNumber(trade?.shares) > 0) {
      tradeShares = Math.max(0, toNumber(trade?.shares));
      const optAmount = toNumber(trade?.amount);
      tradeAmount = roundAmount(optAmount > 0 ? optAmount : tradeShares * safeReferenceNetValue);
    } else {
      tradeAmount = roundAmount(Math.max(0, toNumber(trade?.amount)));
      const optShares = toNumber(trade?.shares);
      if (optShares > 0) {
        tradeShares = optShares;
      } else {
        const netAmount = normalizedType === '买入' ? Math.max(0, tradeAmount - safeFee) : tradeAmount;
        tradeShares = netAmount / safeReferenceNetValue;
      }
    }
  }

  if (tradeAmount <= 0 && tradeShares <= 0) {
    return null;
  }

  let nextShares = safeCurrentShares;
  let nextCostAmount = safeCurrentCostAmount;

  if (normalizedType === '买入') {
    nextShares += tradeShares;
    nextCostAmount = roundAmount(safeCurrentCostAmount + tradeAmount);
  } else if (normalizedType === '卖出') {
    if (safeCurrentShares <= 0) {
      return null;
    }

    const soldShares = Math.min(safeCurrentShares, tradeShares);
    const soldRatio = safeCurrentShares > 0 ? soldShares / safeCurrentShares : 0;
    nextShares = Math.max(0, safeCurrentShares - soldShares);
    nextCostAmount = roundAmount(Math.max(0, safeCurrentCostAmount - safeCurrentCostAmount * soldRatio));
  } else if (normalizedType === '分红') {
    // 现金分红：减少持仓成本（相当于本金退回）
    nextCostAmount = roundAmount(Math.max(0, safeCurrentCostAmount - tradeAmount));
  } else if (normalizedType === '红利再投') {
    // 红利再投：份额增加，本金不变
    nextShares += tradeShares;
    nextCostAmount = roundAmount(safeCurrentCostAmount);
  }

  const normalizedTradeDate = typeof tradeDate === 'string' && tradeDate.trim() ? tradeDate.trim() : getTodayDateKey();
  const nextHoldingStartDate = normalizedType === '买入'
    ? (holdingStartDate || normalizedTradeDate)
    : (normalizedType === '卖出' && nextShares === 0 ? '' : holdingStartDate);

  return {
    type: normalizedType,
    amount: tradeAmount,
    shares: tradeShares,
    fee: safeFee,
    tradeDate: normalizedTradeDate,
    referenceNetValue: safeReferenceNetValue,
    sharesDelta: nextShares - safeCurrentShares,
    costDelta: roundAmount(nextCostAmount - safeCurrentCostAmount),
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
    fee: tradeImpact.fee || 0,
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
