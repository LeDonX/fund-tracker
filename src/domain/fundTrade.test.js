import { describe, expect, it } from 'vitest';
import {
  buildTradeImpact,
  buildTransactionRecord,
  filterTransactionsByFundCode,
  sortTransactionsByDateDesc,
} from './fundTrade';

describe('fundTrade', () => {
  it('买入时应增加份额与成本，并保留最早持有日期', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 120, holdingStartDate: '2024-01-01' },
      trade: { type: '买入', amount: 30 },
      referenceNetValue: 1.5,
      currentShares: 100,
      currentCostAmount: 120,
      tradeDate: '2026-05-14',
    });

    expect(result).toMatchObject({
      type: '买入',
      amount: 30,
      tradeDate: '2026-05-14',
      nextShares: 120,
      nextCostAmount: 150,
      nextHoldingStartDate: '2024-01-01',
    });
    expect(result.sharesDelta).toBeCloseTo(20, 6);
    expect(result.costDelta).toBeCloseTo(30, 6);
  });

  it('卖出时应按卖出比例减少份额与成本', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200, holdingStartDate: '2024-01-01' },
      trade: { type: '卖出', amount: 50 },
      referenceNetValue: 1,
      currentShares: 100,
      currentCostAmount: 200,
      tradeDate: '2026-05-14',
    });

    expect(result).toMatchObject({
      type: '卖出',
      nextShares: 50,
      nextCostAmount: 100,
      nextHoldingStartDate: '2024-01-01',
    });
    expect(result.sharesDelta).toBeCloseTo(-50, 6);
    expect(result.costDelta).toBeCloseTo(-100, 6);
  });

  it('全部卖出后应清空 holdingStartDate', () => {
    const result = buildTradeImpact({
      fund: { shares: 10, costAmount: 20, holdingStartDate: '2024-01-01' },
      trade: { type: '卖出', amount: 20 },
      referenceNetValue: 2,
      currentShares: 10,
      currentCostAmount: 20,
      tradeDate: '2026-05-14',
    });

    expect(result?.nextShares).toBeCloseTo(0, 6);
    expect(result?.nextCostAmount).toBeCloseTo(0, 6);
    expect(result?.nextHoldingStartDate).toBe('');
  });

  it('分红时应只减少成本，不改变份额', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200, holdingStartDate: '2024-01-01' },
      trade: { type: '分红', amount: 30 },
      referenceNetValue: 1.2,
      currentShares: 100,
      currentCostAmount: 200,
    });

    expect(result).toMatchObject({
      type: '分红',
      nextShares: 100,
      nextCostAmount: 170,
      nextHoldingStartDate: '2024-01-01',
    });
    expect(result?.sharesDelta).toBeCloseTo(0, 6);
    expect(result?.costDelta).toBeCloseTo(-30, 6);
  });

  it('无效交易输入应返回 null', () => {
    expect(buildTradeImpact({
      fund: { shares: 100, costAmount: 200 },
      trade: { type: '未知', amount: 10 },
      referenceNetValue: 1,
    })).toBeNull();

    expect(buildTradeImpact({
      fund: { shares: 100, costAmount: 200 },
      trade: { type: '买入', amount: 0 },
      referenceNetValue: 1,
    })).toBeNull();
  });

  it('应根据 tradeImpact 生成交易记录', () => {
    const tradeImpact = buildTradeImpact({
      fund: { shares: 0, costAmount: 0, holdingStartDate: '' },
      trade: { type: '买入', amount: 20 },
      referenceNetValue: 2,
      currentShares: 0,
      currentCostAmount: 0,
      tradeDate: '2026-05-14',
    });

    const record = buildTransactionRecord({
      fund: { id: 1, code: '000001', name: '示例基金' },
      tradeImpact,
    });

    expect(record).toMatchObject({
      fundCode: '000001',
      fundName: '示例基金',
      fundId: 1,
      type: '买入',
      amount: 20,
      tradeDate: '2026-05-14',
    });
    expect(record?.id).toMatch(/^tx_/);
    expect(typeof record?.createdAt).toBe('number');
  });

  it('应按基金代码过滤并按日期倒序排序交易', () => {
    const transactions = [
      { id: '1', fundCode: '000001', tradeDate: '2026-05-13', createdAt: 1 },
      { id: '2', fundCode: '000002', tradeDate: '2026-05-14', createdAt: 1 },
      { id: '3', fundCode: '000001', tradeDate: '2026-05-14', createdAt: 2 },
    ];

    const filtered = filterTransactionsByFundCode(transactions, '000001');
    expect(filtered.map((item) => item.id)).toEqual(['1', '3']);

    const sorted = sortTransactionsByDateDesc(filtered);
    expect(sorted.map((item) => item.id)).toEqual(['3', '1']);
  });
});
