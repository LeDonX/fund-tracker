import { describe, expect, it } from 'vitest';
import {
  buildExportBundle,
  buildImportPreview,
  mergeDetailCacheEntries,
  mergeImportedFunds,
  mergeStringArrays,
  mergeTransactionsById,
  validateImportBundle,
} from './importExport';

describe('importExport', () => {
  it('应构造完整导出包结构', () => {
    const bundle = buildExportBundle({
      funds: [{ code: '000001' }],
      sectors: ['科技'],
      detailCache: { version: 1, entries: { '000001': { code: '000001' } } },
      transactions: [{ id: 'tx-1' }],
    });

    expect(bundle.app).toBe('fund-tracker');
    expect(bundle.version).toBe(1);
    expect(bundle.data.funds).toHaveLength(1);
    expect(bundle.data.sectors).toEqual(['科技']);
    expect(bundle.data.transactions).toHaveLength(1);
  });

  it('应校验导入包格式', () => {
    expect(validateImportBundle(null)).toEqual({ ok: false, error: '导入文件不是有效的 JSON 对象。' });
    expect(validateImportBundle({})).toEqual({ ok: false, error: '导入文件缺少 data 字段。' });
    expect(validateImportBundle({ data: { funds: [], sectors: [] } })).toEqual({ ok: true, error: '' });
  });

  it('应生成导入预览摘要', () => {
    const preview = buildImportPreview({
      app: 'fund-tracker',
      version: 1,
      data: {
        funds: [{ code: '000001' }, { code: '000002' }],
        sectors: ['科技', '消费'],
        transactions: [{ id: '1' }],
        detailCache: { entries: { '000001': {}, '000002': {} } },
      },
    });

    expect(preview).toEqual({
      app: 'fund-tracker',
      version: 1,
      fundsCount: 2,
      sectorsCount: 2,
      transactionsCount: 1,
      detailCacheCount: 2,
    });
  });

  it('追加基金时应按 code 去重', () => {
    const merged = mergeImportedFunds(
      [{ code: '000001', name: 'A' }],
      [{ code: '000001', name: 'A2' }, { code: '000002', name: 'B' }],
    );

    expect(merged.map((item) => item.code)).toEqual(['000001', '000002']);
  });

  it('应合并字符串数组并去重去空白', () => {
    const merged = mergeStringArrays([' 科技 ', '消费'], ['消费', '  ', '医疗']);
    expect(merged).toEqual(['科技', '消费', '医疗']);
  });

  it('应合并详情缓存 entries', () => {
    const merged = mergeDetailCacheEntries(
      { '000001': { code: '000001', fetchedAt: 1 } },
      { '000002': { code: '000002', fetchedAt: 2 } },
    );

    expect(Object.keys(merged)).toEqual(['000001', '000002']);
  });

  it('应按 id 合并交易记录并避免重复', () => {
    const merged = mergeTransactionsById(
      [{ id: 'tx-1', amount: 1 }],
      [{ id: 'tx-1', amount: 2 }, { id: 'tx-2', amount: 3 }],
    );

    expect(merged).toEqual([
      { id: 'tx-1', amount: 1 },
      { id: 'tx-2', amount: 3 },
    ]);
  });
});
