import { describe, expect, it } from 'vitest';
import {
  buildTradeImpact,
  buildTransactionRecord,
  filterTransactionsByFundCode,
  sortTransactionsByDateDesc,
  parseOcrText,
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

  it('卖出时按份额赎回应减少对应份额，且成本按比例扣减', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200, holdingStartDate: '2024-01-01' },
      trade: { type: '卖出', shares: 30, volumeType: 'shares' },
      referenceNetValue: 1.5, // 卖出时的单位净值
      currentShares: 100,
      currentCostAmount: 200,
      tradeDate: '2026-05-14',
    });

    expect(result).toMatchObject({
      type: '卖出',
      amount: 45, // 30 份 * 1.5 = 45 元
      shares: 30,
      nextShares: 70,
      nextCostAmount: 140, // 200 - 200 * (30/100) = 140
      nextHoldingStartDate: '2024-01-01',
    });
    expect(result.sharesDelta).toBe(-30);
    expect(result.costDelta).toBe(-60);
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

  it('红利再投时应增加份额，保持成本不变', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200, holdingStartDate: '2024-01-01' },
      trade: { type: '红利再投', shares: 50, volumeType: 'shares' },
      referenceNetValue: 1.2,
      currentShares: 100,
      currentCostAmount: 200,
    });

    expect(result).toMatchObject({
      type: '红利再投',
      nextShares: 150,
      nextCostAmount: 200,
      nextHoldingStartDate: '2024-01-01',
    });
    expect(result?.sharesDelta).toBeCloseTo(50, 6);
    expect(result?.costDelta).toBeCloseTo(0, 6);
  });

  it('交易同步支持双向可选参数：在金额口径下传入可选份额应直接使用该份额', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200 },
      trade: { type: '买入', amount: 300, shares: 250, volumeType: 'amount' },
      referenceNetValue: 1.5, // 自动折算为 200 份，但手动填了 250 份
      currentShares: 100,
      currentCostAmount: 200,
    });

    expect(result).toMatchObject({
      type: '买入',
      amount: 300,
      shares: 250,
      nextShares: 350,
      nextCostAmount: 500,
    });
  });

  it('交易同步支持双向可选参数：在份额口径下传入可选金额应直接使用该金额作为本金成本', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200 },
      trade: { type: '买入', amount: 120, shares: 100, volumeType: 'shares' },
      referenceNetValue: 1.5, // 自动折算为 150 元，但手动填了 120 元
      currentShares: 100,
      currentCostAmount: 200,
    });

    expect(result).toMatchObject({
      type: '买入',
      amount: 120,
      shares: 100,
      nextShares: 200,
      nextCostAmount: 320,
    });
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

  it('交易同步支持扣除手续费：买入时应在扣除手续费后折算份额', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 200 },
      trade: { type: '买入', amount: 100, fee: 10, volumeType: 'amount' },
      referenceNetValue: 1.5,
      currentShares: 100,
      currentCostAmount: 200,
    });

    expect(result).toMatchObject({
      type: '买入',
      amount: 100,
      fee: 10,
      nextCostAmount: 300, // 200 + 100 = 300
    });
    // 净买入金额为 100 - 10 = 90 元
    // 份额增加为 90 / 1.5 = 60 份
    expect(result.sharesDelta).toBeCloseTo(60, 6);
    expect(result.nextShares).toBeCloseTo(160, 6);
  });

  it('应在交易记录中持久化手续费字段', () => {
    const tradeImpact = buildTradeImpact({
      fund: { shares: 0, costAmount: 0 },
      trade: { type: '买入', amount: 100, fee: 5 },
      referenceNetValue: 2,
      currentShares: 0,
      currentCostAmount: 0,
    });

    const record = buildTransactionRecord({
      fund: { id: 1, code: '000001', name: '示例基金' },
      tradeImpact,
    });

    expect(record).toMatchObject({
      fundCode: '000001',
      fee: 5,
    });
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

  it('应将发生金额、手续费、成本变动等货币值精确舍入到 2 位小数', () => {
    const result = buildTradeImpact({
      fund: { shares: 100, costAmount: 100 },
      trade: { type: '买入', amount: 10.128, fee: 0.123, volumeType: 'amount' },
      referenceNetValue: 1.5,
      currentShares: 100,
      currentCostAmount: 100,
    });

    expect(result).toMatchObject({
      amount: 10.13, // 10.128 rounded to 2 decimals
      fee: 0.12,    // 0.123 rounded to 2 decimals
      nextCostAmount: 110.13, // 100 + 10.13 = 110.13
      costDelta: 10.13,
    });
  });

  describe('parseOcrText', () => {
    it('应完美解析多行交错排版的支付宝基金买入记录', () => {
      const ocrOutput = `
买入 基金 | 招商上证科创板芯片设计主题指数C 2,000.00元
2026-05-15 14:35:19
买入 基金 | 鹏华创新未来混合(LOF)C 3,000.00元
2026-05-15 14:34:25
      `;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        type: '买入',
        name: '招商上证科创板芯片设计主题指数C',
        amount: 2000.00,
        tradeDate: '2026-05-15 14:35:19',
      });
      expect(results[1]).toMatchObject({
        type: '买入',
        name: '鹏华创新未来混合(LOF)C',
        amount: 3000.00,
        tradeDate: '2026-05-15 14:34:25',
      });
    });

    it('应完美解析包含卖出操作和各种中文符号的记录', () => {
      const ocrOutput = `
卖出 基金 | 易方达蓝筹精选混合 1,234.56元
2026/05/14 15:00:00
      `;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: '卖出',
        name: '易方达蓝筹精选混合',
        amount: 1234.56,
        tradeDate: '2026-05-14 15:00:00',
      });
    });

    it('应容忍常见的 OCR 识别错误并正确解析', () => {
      // 常见错漏：字母 o 代替数字 0，全角标点，未加空格等
      const ocrOutput = `
买入 基金|英大策略优选混合C 4,ooo.oo元
2026年05月13日 14:56:36
      `;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: '买入',
        name: '英大策略优选混合C',
        amount: 4000.00,
        tradeDate: '2026-05-13 14:56:36',
      });
    });

    it('应支持单行合并解析的场景', () => {
      const ocrOutput = `买入 基金 | 鹏华国证半导体芯片ETF联接C 3,000.00元 2026-05-14 14:22:08`;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: '买入',
        name: '鹏华国证半导体芯片ETF联接C',
        amount: 3000.00,
        tradeDate: '2026-05-14 14:22:08',
      });
    });

    it('如果没有找到时间锚点，应触发兜底提取策略', () => {
      const ocrOutput = `买入 基金 | 方正富邦核心优势混合C 3,000.00元`;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: '买入',
        name: '方正富邦核心优势混合C',
        amount: 3000.00,
      });
      expect(results[0].tradeDate).toContain('00:00:00'); // 包含今日日期和零点兜底
    });

    it('应完美合并跨行换行截断的基金名称', () => {
      const ocrOutput = `
招商 上 证 科 创 板 芯片 设
计 主 题 指数 C
买入 2,000.00元
2026-05-24 10:00:00
      `;
      const results = parseOcrText(ocrOutput);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        type: '买入',
        name: '招商上证科创板芯片设计主题指数C',
        amount: 2000.00,
        tradeDate: '2026-05-24 10:00:00',
      });
    });
  });
});
