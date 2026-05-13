import React from 'react';
import FormatNumber from '../common/FormatNumber';

const formatCurrencyAmount = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPlainNumber = (value, suffix = '') => {
  if (!Number.isFinite(value)) return '--';
  return `${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
};

const formatDayCount = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `${value} 天`;
};

function DetailMetricCard({ label, value, testId, hint, accent = 'slate', children }) {
  const accentClass = accent === 'blue'
    ? 'border-blue-200 bg-blue-50/80'
    : accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/80'
      : 'border-slate-200 bg-white/90';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accentClass}`} data-testid={testId}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{children ?? value}</div>
      {hint && <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function DetailStatRow({ label, value, testId, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm" data-testid={testId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700">{label}</div>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
        </div>
        <div className="text-right text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

export default function FundDetailPanel({
  isOpen,
  onClose,
  onRefresh,
  detailModel,
  isLoading,
  hasStaleCache,
  errorMessage,
}) {
  if (!isOpen || !detailModel) return null;

  const valuationSourceLabel = detailModel.valuationSource === 'official'
    ? '当前列表使用官方净值口径'
    : detailModel.valuationSource === 'estimate'
      ? '当前列表使用盘中估值口径'
      : detailModel.valuationSource === 'quote'
        ? '当前列表使用最新净值口径'
        : '当前列表使用本地快照口径';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" data-testid="fund-detail-overlay">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-200 bg-white/95 px-5 py-4 md:px-8 md:py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-medium text-slate-600">{detailModel.code}</span>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{valuationSourceLabel}</span>
                    {detailModel.cacheFetchedAt > 0 && (
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-500">
                        详情缓存已更新
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl" data-testid="detail-fund-name">{detailModel.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    详情页将当前列表口径与官方净值历史拆开展示：持有金额 / 当日收益沿用列表展示口径，昨日收益与阶段涨幅只在有官方净值历史时展示。
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading}
                    data-testid="refresh-fund-detail"
                  >
                    {isLoading ? '刷新中...' : '刷新详情'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                    data-testid="close-fund-detail"
                  >
                    返回列表
                  </button>
                </div>
              </div>

              {(isLoading || errorMessage || hasStaleCache) && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600" data-testid="detail-fetch-status">
                  {isLoading && <p>正在刷新详情缓存，列表口径不会被这次详情请求阻塞。</p>}
                  {!isLoading && hasStaleCache && <p>远端详情暂时不可用，当前显示的是最近一次成功缓存的数据。</p>}
                  {!isLoading && errorMessage && !hasStaleCache && <p>{errorMessage}</p>}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-7">
              <section className="grid gap-4 lg:grid-cols-4">
                <DetailMetricCard
                  label="持有金额"
                  testId="detail-field-holding-amount"
                  value={formatCurrencyAmount(detailModel.holdingAmount)}
                  hint="当前列表展示口径下的持仓金额。"
                  accent="blue"
                />
                <DetailMetricCard
                  label="当日收益"
                  testId="detail-field-daily-profit"
                  hint="沿用当前列表的展示口径；若列表正在用估值，这里也显示估值口径。"
                  accent="blue"
                >
                  <FormatNumber value={detailModel.dailyProfit} isCurrency={true} />
                </DetailMetricCard>
                <DetailMetricCard
                  label="最新净值"
                  testId="detail-field-latest-net-value"
                  value={formatPlainNumber(detailModel.latestNetValue)}
                  hint={detailModel.officialLatestDate ? `优先官方净值，最新日期 ${detailModel.officialLatestDate}` : '官方净值缺失时回退最新可用净值。'}
                  accent="emerald"
                />
                <DetailMetricCard
                  label="估算净值"
                  testId="detail-field-estimated-net-value"
                  value={formatPlainNumber(detailModel.estimatedNetValue)}
                  hint={detailModel.quoteUpdateTime ? `盘中估值更新时间 ${detailModel.quoteUpdateTime}` : '盘中估值不可用时显示 --。'}
                  accent="emerald"
                >
                  {formatPlainNumber(detailModel.estimatedNetValue)}
                </DetailMetricCard>
              </section>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">持仓语义</h3>
                    <p className="mt-2 text-sm text-slate-500">这里的字段只根据源持仓、列表展示值、组合总额和详情缓存派生，不会把详情页推导值反写回持仓列表。</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailStatRow label="持有份额" testId="detail-field-shares" value={formatPlainNumber(detailModel.shares, ' 份')} />
                    <DetailStatRow label="持仓占比" testId="detail-field-holding-ratio" value={<FormatNumber value={detailModel.holdingRatio} isPercent={true} />} hint="持有金额 / 当前组合持有金额" />
                    <DetailStatRow label="持有收益" testId="detail-field-holding-profit" value={<FormatNumber value={detailModel.holdingProfit} isCurrency={true} />} hint="持有金额 - 总持仓成本" />
                    <DetailStatRow label="持有收益率" testId="detail-field-holding-profit-rate" value={<FormatNumber value={detailModel.holdingProfitRate} isPercent={true} />} hint="持有收益 / 总持仓成本" />
                    <DetailStatRow label="持仓成本" testId="detail-field-unit-cost" value={formatPlainNumber(detailModel.unitCost)} hint={Number.isFinite(detailModel.totalCostAmount) ? `单位持仓成本；总成本约 ${formatCurrencyAmount(detailModel.totalCostAmount)}` : '缺少可用总成本时显示 --。'} />
                    <DetailStatRow label="持有天数" testId="detail-field-holding-days" value={formatDayCount(detailModel.holdingDays)} hint={detailModel.holdingStartDate ? `起始日 ${detailModel.holdingStartDate}` : '旧持仓没有起始日期，不回填历史。'} />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">净值与行情口径</h3>
                        <p className="mt-2 text-sm text-slate-500">当日收益与最新净值故意拆开，避免把估值和官方净值混成一个字段。</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <DetailStatRow label="昨日收益" testId="detail-field-yesterday-profit" value={<FormatNumber value={detailModel.yesterdayProfit} isCurrency={true} />} hint={detailModel.officialLatestDate && detailModel.officialPreviousDate ? `按 ${detailModel.officialLatestDate} 与 ${detailModel.officialPreviousDate} 两个官方净值点计算` : '缺少连续两个官方净值点时显示 --。'} />
                      <DetailStatRow label="关联板块" testId="detail-field-related-themes" value={detailModel.relatedThemes.length > 0 ? detailModel.relatedThemes.join(' / ') : '--'} hint={detailModel.isRelatedThemesFallback ? '远端主题标签暂不可用，当前回退到本地分组。' : '优先显示远端主题 / 板块标签。'} />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">阶段表现</h3>
                    <p className="mt-2 text-sm text-slate-500">只根据官方净值历史推导；历史不够长时维持 --，不做补猜。</p>
                    <div className="mt-4 space-y-3">
                      <DetailStatRow label="今年涨幅" testId="detail-field-performance-ytd" value={<FormatNumber value={detailModel.performance.ytd} isPercent={true} />} />
                      <DetailStatRow label="近1年" testId="detail-field-performance-1y" value={<FormatNumber value={detailModel.performance.oneYear} isPercent={true} />} />
                      <DetailStatRow label="近3年" testId="detail-field-performance-3y" value={<FormatNumber value={detailModel.performance.threeYear} isPercent={true} />} />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-slate-100 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">数据来源</h3>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                      <p>持有金额 / 当日收益：来自当前列表的展示 fund snapshot。</p>
                      <p>昨日收益 / 今年涨幅 / 近1年 / 近3年：来自东财官方净值历史缓存。</p>
                      <p>估算净值 / 最新净值补位：来自天天基金估值 JSONP 缓存。</p>
                      <p>关联板块：优先远端主题标签，拿不到时回退本地分组。</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
