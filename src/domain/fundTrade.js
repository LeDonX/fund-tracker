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

/**
 * Smart Alipay Fund Transaction OCR Text Parser (Pure Local / Offline)
 * Supports interleaved line parsing and columnar zipping fallbacks for high-accuracy local OCR.
 */
export const parseOcrText = (text) => {
  if (!text || typeof text !== 'string') return [];

  // Normalize common OCR typos
  let cleanedText = text
    .replace(/[\uff0c]/g, ',') // Full-width comma to half-width
    .replace(/[\u2014-\u2015]/g, '-') // Em-dash to hyphen
    .replace(/买人/g, '买入') // Common Chinese OCR mistake (入 looks like 人)
    .replace(/卖山/g, '卖出') // Common Chinese OCR mistake
    .replace(/元/g, ' 元 ') // Pad '元'
    .replace(/无\s*$/gm, '元') // If 元 is misread as 无 at line end
    .replace(/[^\S\r\n]+/g, ' '); // Collapse horizontal spaces only

  const lines = cleanedText.split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  // Define Date regex that supports colons or periods for time (e.g. 14.35.19 or 14:35:19)
  // We allow letter 'o' or 'O' in place of '0' in dates (e.g. 2o26)
  const dateRegex = /([2\d][oO\d]{3})[-\/年\s]([oO\d]{1,2})[-\/月\s]([oO\d]{1,2})日?(?:\s*([oO\d]{1,2})[:\.]([oO\d]{1,2})(?:[:\.]([oO\d]{1,2}))?)?/;
  const amountRegex = /([\d,oO]+\.[\doO]{2})/;

  // Helper to check if a line is a noise boilerplate
  const isBoilerplate = (line) => {
    if (!line) return true;
    const cleaned = line.replace(/\s+/g, '');
    const boilerplate = new Set([
      '全部持有', '收益明细', '交易记录', '全部', '明细', '基金', '全部基金', '工具与设置', '工具', '同步与登记交易', '同步交易', '登记交易', '支付宝'
    ]);
    if (boilerplate.has(line) || boilerplate.has(cleaned)) return true;
    
    // Check for noise keywords (strictly specific keywords to avoid filtering out valid fund name parts like "设计" or "工具")
    const noiseWords = ['明细', '全部', '交易记录', '账单', '历史', '筛选', '分类', '查询', '搜索'];
    for (const word of noiseWords) {
      if (cleaned.includes(word)) return true;
    }
    return false;
  };

  // Helper to normalize OCR 'o'/'O' to '0' inside numeric fields
  const normalizeOcrNumbers = (val) => {
    if (!val) return '';
    return val.replace(/[oO]/g, '0');
  };

  // ----------------------------------------------------
  // STRATEGY A: Sequential / Proximity Interleaved Pairing
  // ----------------------------------------------------
  const strategyAEntries = [];
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const dateMatch = currentLine.match(dateRegex);

    if (dateMatch) {
      const [_, rYear, rMonth, rDay, rHour, rMinute, rSecond] = dateMatch;
      const year = normalizeOcrNumbers(rYear);
      const month = normalizeOcrNumbers(rMonth);
      const day = normalizeOcrNumbers(rDay);
      const hour = normalizeOcrNumbers(rHour);
      const minute = normalizeOcrNumbers(rMinute);
      const second = normalizeOcrNumbers(rSecond);

      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const formattedTime = hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${(second || '00').padStart(2, '0')}` : '';
      const fullDateTime = formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;

      // Look backward for nearest transaction detail line
      let txLine = '';
      
      // If current line has type keywords before the date
      if ((currentLine.includes('买') || currentLine.includes('卖')) && currentLine.indexOf(rYear) > 2) {
        txLine = currentLine.substring(0, currentLine.indexOf(rYear)).trim();
      }

      if (!txLine) {
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j];
          if (!prevLine.match(dateRegex)) {
            txLine = prevLine;
            break;
          }
        }
      }

      if (txLine) {
        let type = txLine.includes('卖') ? '卖出' : '买入';
        
        let amount = 0;
        const amountMatch = txLine.match(amountRegex) || txLine.match(/([oO\d]+)\s*元/);
        if (amountMatch) {
          const cleanAmountStr = normalizeOcrNumbers(amountMatch[1]).replace(/,/g, '');
          amount = parseFloat(cleanAmountStr);
        }

        let fundName = txLine
          .replace(/买\s*入/g, '').replace(/卖\s*出/g, '').replace(/买/g, '').replace(/卖/g, '')
          .replace(/基金\s*\|\s*/g, '').replace(/基金/g, '')
          .trim();

        if (amountMatch) {
          fundName = fundName.replace(amountMatch[0], '');
        }

        fundName = fundName
          .replace(/元/g, '')
          .replace(/^\s*\|\s*/, '')
          .replace(/^[入人出山此雌|•\s\d]+/, '') // Strip leading leftover typos from type or top icons!
          .replace(/\s+/g, '') // Strip all spaces inside fund name
          .trim();

        if (fundName && amount > 0 && !isBoilerplate(fundName)) {
          strategyAEntries.push({
            type,
            name: fundName,
            amount,
            tradeDate: fullDateTime,
            originalText: `${txLine} | ${currentLine}`
          });
        }
      }
    }
  }

  // ----------------------------------------------------
  // STRATEGY B: Column Zipping (when Tesseract separates columns)
  // ----------------------------------------------------
  const strategyBEntries = [];
  
  // 1. Extract all Dates
  const extractedDates = [];
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const [_, rYear, rMonth, rDay, rHour, rMinute, rSecond] = match;
      const year = normalizeOcrNumbers(rYear);
      const month = normalizeOcrNumbers(rMonth);
      const day = normalizeOcrNumbers(rDay);
      const hour = normalizeOcrNumbers(rHour);
      const minute = normalizeOcrNumbers(rMinute);
      const second = normalizeOcrNumbers(rSecond);

      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const formattedTime = hour ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${(second || '00').padStart(2, '0')}` : '';
      extractedDates.push(formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate);
    }
  }

  // 2. Extract all Amounts
  const extractedAmounts = [];
  for (const line of lines) {
    // Avoid lines matching dates to prevent misidentifying year/day as amount
    if (line.match(dateRegex)) continue;
    const match = line.match(amountRegex) || line.match(/([oO\d]+)\s*元/);
    if (match) {
      const cleanAmountStr = normalizeOcrNumbers(match[1]).replace(/,/g, '');
      extractedAmounts.push(parseFloat(cleanAmountStr));
    }
  }

  // 3. Extract all Types
  const extractedTypes = [];
  for (const line of lines) {
    if (line.match(dateRegex)) continue;
    if (line.includes('买') || line.includes('入')) {
      extractedTypes.push('买入');
    } else if (line.includes('卖') || line.includes('出')) {
      extractedTypes.push('卖出');
    }
  }

  // 4. Extract all Fund Names
  // Fund names are lines (or stripped lines) that:
  // - Do not contain only boilerplate
  // - Contain Chinese characters and are longer than 4 chars after stripping metadata
  const extractedNames = [];
  
  for (const line of lines) {
    if (line.match(dateRegex)) continue;
    if (isBoilerplate(line)) continue;
    
    let cleanName = line
      .replace(dateRegex, '')
      .replace(amountRegex, '')
      .replace(/[oO\d]+\s*元/, '')
      .replace(/买\s*入/g, '').replace(/卖\s*出/g, '').replace(/买/g, '').replace(/卖/g, '')
      .replace(/基金\s*\|\s*/g, '').replace(/基金/g, '')
      .replace(/^[入人出山此雌|•\s\d]+/, '') // Strip leading leftover typos from type or top icons!
      .replace(/元\s*$/, '') // Clean trailing 元
      .replace(/\s+/g, '') // Strip all spaces inside fund name
      .trim();

    if (cleanName.length >= 4 && /[\u4e00-\u9fa5]/.test(cleanName) && !isBoilerplate(cleanName)) {
      extractedNames.push(cleanName);
    }
  }

  // Merge wrapped fund name fragments (e.g. "招商上证科创板芯片设" + "计主题指数C")
  const finalNames = [];
  const suffixRegex = /(混合|指数|债券|股票|精选|增强|价值|成长|主题|核心|科技|联接|定开|定期开放|封闭式|LOF|ETF|理财|配置|QDII|FOF|[a-zA-Z])$/i;
  
  for (let i = 0; i < extractedNames.length; i++) {
    const current = extractedNames[i];
    
    if (finalNames.length > 0) {
      const last = finalNames[finalNames.length - 1];
      // If the last name does NOT end with a standard fund suffix,
      // and the current name is short (likely a wrapped fragment, < 8 chars)
      if (!suffixRegex.test(last) && current.length < 8) {
        finalNames[finalNames.length - 1] = last + current;
        continue;
      }
    }
    
    finalNames.push(current);
  }

  // Zip columns together if we have matches in all columns
  const zipCount = Math.max(extractedDates.length, extractedAmounts.length, finalNames.length);
  if (zipCount > 0) {
    for (let i = 0; i < zipCount; i++) {
      const name = finalNames[i] || (finalNames[0] || '未命名基金');
      const amount = extractedAmounts[i] || 0;
      const tradeDate = extractedDates[i] || (getTodayDateKey() + ' 00:00:00');
      const type = extractedTypes[i] || '买入';

      if (name && amount > 0) {
        strategyBEntries.push({
          type,
          name,
          amount,
          tradeDate,
          originalText: `Zipped index ${i}`
        });
      }
    }
  }

  // Return the strategy that found more valid transaction records!
  if (strategyAEntries.length >= strategyBEntries.length) {
    return strategyAEntries;
  } else {
    return strategyBEntries;
  }
};


