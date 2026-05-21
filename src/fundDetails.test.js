import { describe, expect, it } from 'vitest';
import {
  buildDetailCacheEntry,
  buildStoredDetailCachePayload,
  createEmptyDetailCacheStore,
  isDetailCacheStale,
  normalizeStoredDetailCacheStore,
} from './fundDetails';

describe('fundDetails', () => {
  it('应创建空缓存结构', () => {
    expect(createEmptyDetailCacheStore()).toEqual({
      version: 2,
      entries: {},
    });
  });

  it('应将无效存储值标准化为空缓存', () => {
    expect(normalizeStoredDetailCacheStore(null)).toEqual({
      version: 2,
      entries: {},
    });
  });

  it('应标准化旧格式 entries 并清洗无效字段', () => {
    const normalized = normalizeStoredDetailCacheStore({
      version: 2,
      entries: {
        '000001': {
          fetchedAt: 123,
          quote: {
            estimatedNetValue: '1.2345',
            lastNetValue: '1.2000',
            updateTime: '14:30',
            netValueDate: '2026-05-14',
          },
          officialHistory: [
            { date: '2026-05-13', netValue: '1.21', dailyRate: '1.2' },
            { date: '2026-05-14', netValue: '1.22', dailyRate: '0.8' },
            { date: '', netValue: '0' },
          ],
          remoteThemes: [' 科技 ', '', '科技'],
        },
      },
    });

    expect(normalized.version).toBe(2);
    expect(normalized.entries['000001']).toMatchObject({
      code: '000001',
      fetchedAt: 123,
      quote: {
        estimatedNetValue: 1.2345,
        lastNetValue: 1.2,
        updateTime: '14:30',
        netValueDate: '2026-05-14',
      },
      remoteThemes: ['科技'],
    });
    expect(normalized.entries['000001'].officialHistory).toEqual([
      { date: '2026-05-14', netValue: 1.22, dailyRate: 0.8 },
      { date: '2026-05-13', netValue: 1.21, dailyRate: 1.2 },
    ]);
  });

  it('应构造单条详情缓存记录并排序官方历史', () => {
    const entry = buildDetailCacheEntry({
      code: '000001',
      quote: {
        estimatedNetValue: '1.30',
        lastNetValue: '1.20',
        updateTime: '14:35',
        netValueDate: '2026-05-14',
      },
      officialHistory: [
        { date: '2026-05-13', netValue: '1.20', dailyRate: '1.0' },
        { date: '2026-05-14', netValue: '1.22', dailyRate: '1.1' },
      ],
      remoteThemes: ['科技', '科技', '消费'],
    });

    expect(entry.code).toBe('000001');
    expect(entry.quote.estimatedNetValue).toBe(1.3);
    expect(entry.officialHistory[0].date).toBe('2026-05-14');
    expect(entry.remoteThemes).toEqual(['科技', '消费']);
    expect(typeof entry.fetchedAt).toBe('number');
  });

  it('应构造可存储的缓存 payload', () => {
    const payload = buildStoredDetailCachePayload({
      '000001': { code: '000001', fetchedAt: 1 },
    });

    expect(payload).toEqual({
      version: 2,
      entries: {
        '000001': { code: '000001', fetchedAt: 1 },
      },
    });
  });

  it('应判断缓存是否过期', () => {
    expect(isDetailCacheStale({ fetchedAt: 0 }, 100)).toBe(true);
    expect(isDetailCacheStale({ fetchedAt: Date.now() }, Date.now())).toBe(false);
  });
});
