import React, { useState } from 'react';
import { AlertCircle, Zap, Calendar, ArrowRight, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from '../common/Modal';

export default function AddFundModal({
  isOpen,
  onClose,
  onSubmit,
  fundForm,
  setFundForm,
  handleFundCodeChange,
  fundLookup,
  sectors,
}) {
  const entryMode = fundForm.entryMode || 'newBuy';
  const confirmTime = fundForm.confirmTime || 'before15';
  const includeDailyProfit = fundForm.includeDailyProfit || 'yes';
  const lastNetValue = fundLookup.quote?.lastNetValue || 0;
  const estimatedNetValue = fundLookup.quote?.estimatedNetValue || 0;
  const refNetValue = estimatedNetValue > 0 ? estimatedNetValue : (lastNetValue > 0 ? lastNetValue : 0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 计算用于折算的净值：新买入以估算/今日收盘价成交；已持有若包含今日收益用今日收盘价，不包含时用昨日收盘价
  const bootstrapNetValue = entryMode === 'newBuy'
    ? refNetValue
    : (includeDailyProfit === 'yes' ? refNetValue : (lastNetValue > 0 ? lastNetValue : refNetValue));

  // 金额和收益的转化与计算
  const amountVal = Number.parseFloat(fundForm.amount) || 0;
  const holdingProfitVal = Number.parseFloat(fundForm.holdingProfit) || 0;
  const derivedCost = entryMode === 'newBuy' ? amountVal : Math.max(0, amountVal - holdingProfitVal);
  const derivedCostRaw = entryMode === 'newBuy' ? amountVal : amountVal - holdingProfitVal;
  const derivedShares = bootstrapNetValue > 0 ? amountVal / bootstrapNetValue : 0;

  // 基础表单验证
  const isCodeValid = /^\d{6}$/.test(fundForm.code) && fundLookup.status === 'success';
  const isSectorValid = Boolean(fundForm.sector) && sectors.includes(fundForm.sector);
  const isAmountValid = Number.isFinite(amountVal) && amountVal > 0;
  const isProfitValid = entryMode === 'newBuy' || Number.isFinite(holdingProfitVal);
  const isCostValid = entryMode === 'newBuy' || derivedCostRaw >= 0;

  const canSubmit = isCodeValid && isSectorValid && isAmountValid && isProfitValid && isCostValid;

  const handleModeChange = (mode) => {
    setFundForm((prev) => ({
      ...prev,
      entryMode: mode,
      includeDailyProfit: 'yes',
      confirmTime: 'before15',
      amount: '',
      holdingProfit: '',
      shares: '',
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增基金持仓" maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-5">
        {/* 1. 基金代码与自动查询 */}
        <div>
          <label htmlFor="fund-code" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">基金代码</label>
          <div className="relative rounded-xl shadow-sm">
            <input
              id="fund-code"
              type="text"
              required
              maxLength={6}
              value={fundForm.code}
              onChange={(e) => handleFundCodeChange(e.target.value)}
              placeholder="请输入6位基金代码，如：005827"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono font-bold text-slate-800 placeholder-slate-400"
            />
          </div>
          <div className="mt-2.5 space-y-1">
            <p className={`flex items-center gap-2 text-xs font-bold ${fundLookup.status === 'success' ? 'text-emerald-600' : fundLookup.status === 'error' ? 'text-rose-600' : fundLookup.status === 'loading' ? 'text-blue-600 animate-pulse' : 'text-slate-500'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${fundLookup.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : fundLookup.status === 'error' ? 'bg-rose-500' : fundLookup.status === 'loading' ? 'bg-blue-500 animate-ping' : 'bg-slate-300'}`}></span>
              <span>{fundLookup.message}</span>
            </p>
            {fundLookup.status === 'success' && (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1.5 text-xs text-slate-600 flex items-center justify-between">
                <span>基金名称：<strong className="text-slate-800 font-bold">{fundLookup.quote?.name}</strong></span>
                <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-10 font-bold">¥{refNetValue.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>

        {fundLookup.status === 'success' && (
          <>
            {/* 2. 所属分组选择 */}
            <div>
              <label htmlFor="fund-sector" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">所属分组</label>
              <select
                id="fund-sector"
                required
                value={fundForm.sector}
                onChange={(e) => setFundForm({ ...fundForm, sector: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white font-semibold text-slate-700 cursor-pointer transition-all"
              >
                {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>

            {/* 3. 录入模式 Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">录入方式</label>
              <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 border border-slate-200/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleModeChange('newBuy')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all duration-200 ${entryMode === 'newBuy' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20 hover:scale-[1.01]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>新买入一笔</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('existing')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black rounded-xl transition-all duration-200 ${entryMode === 'existing' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20 hover:scale-[1.01]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>添加已有持仓</span>
                </button>
              </div>
            </div>

            {/* 4. 根据模式展示相应的切换配置 */}
            {entryMode === 'newBuy' ? (
              /* --- 新买入模式展示成交确认时间 --- */
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">成交确认时间</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFundForm(prev => ({ ...prev, confirmTime: 'before15' }))}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${confirmTime === 'before15' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>15点前 (今日成交)</span>
                    <span className="text-9 opacity-75 font-medium mt-1">
                      今日收盘价成交，今日收益为0
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFundForm(prev => ({ ...prev, confirmTime: 'after15' }))}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${confirmTime === 'after15' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>15点后 (明后日结算)</span>
                    <span className="text-9 opacity-75 font-medium mt-1">
                      下一交易日收盘成交，暂无今日收益
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* --- 添加已持有模式展示是否包含今日收益 --- */
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">是否包含今日收益</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFundForm(prev => ({ ...prev, includeDailyProfit: 'no' }))}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${includeDailyProfit === 'no' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>否 (未包含)</span>
                    <span className="text-9 opacity-75 font-medium mt-1">
                      输入为昨日市值，今日收益额外累加
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFundForm(prev => ({ ...prev, includeDailyProfit: 'yes' }))}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${includeDailyProfit === 'yes' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    <span>是 (已包含)</span>
                    <span className="text-9 opacity-75 font-medium mt-1">
                      输入已是最新市值，已计入今日盈亏
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* 5. 动态表单输入 */}
            <div className="space-y-4 bg-slate-50/60 border border-slate-200 p-4 rounded-2xl">
              {entryMode === 'newBuy' ? (
                /* --- 新买入模式表单 --- */
                <div>
                  <label htmlFor="fund-amount-buy" className="block text-xs font-extrabold text-slate-600 mb-1.5">买入确认金额 (元)</label>
                  <input
                    id="fund-amount-buy"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={fundForm.amount}
                    onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })}
                    placeholder="请输入最终买入扣款金额"
                    className="add-fund-number-input w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
                  />
                  <p className="text-10 text-slate-400 mt-1">资金从银行卡扣除的申购确认金额</p>
                </div>
              ) : (
                /* --- 添加已持有模式表单 --- */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fund-amount-exist" className="block text-xs font-extrabold text-slate-600 mb-1.5">总持有金额 (元)</label>
                    <input
                      id="fund-amount-exist"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={fundForm.amount}
                      onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })}
                      placeholder="即当前持有市值"
                      className="add-fund-number-input w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
                    />
                    <p className="text-10 text-slate-400 mt-1">输入金额对应的总市值</p>
                  </div>
                  <div>
                    <label htmlFor="fund-profit-exist" className="block text-xs font-extrabold text-slate-600 mb-1.5">当前累计收益 (元)</label>
                    <input
                      id="fund-profit-exist"
                      type="number"
                      step="0.01"
                      required
                      value={fundForm.holdingProfit}
                      onChange={(e) => setFundForm({ ...fundForm, holdingProfit: e.target.value })}
                      placeholder="累计持有收益"
                      className="add-fund-number-input w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
                    />
                    <p className="text-10 text-slate-400 mt-1">即总盈利（亏损填负数）</p>
                  </div>
                </div>
              )}

              {/* 6. 财务核算预览面板 */}
              {isAmountValid && (
                <div className={`rounded-xl border p-4 text-xs font-medium font-mono space-y-1.5 ${isCostValid ? 'border-slate-200 bg-white text-slate-600' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <div className="font-extrabold text-slate-700 flex items-center gap-1 mb-2 font-sans">
                    <AlertCircle className="w-4 h-4 text-blue-500" />
                    <span>财务智能分析与折算明细</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                    <span>持仓成本本金:</span>
                    <span className="font-bold text-slate-800">¥{derivedCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {bootstrapNetValue > 0 ? (
                    <>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                        <span>折算参考净值:</span>
                        <span className="font-bold text-slate-800">¥{bootstrapNetValue.toFixed(4)}/份</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                        <span>预估折算份额:</span>
                        <span className="font-bold text-slate-800">
                          {derivedShares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 份
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                        <span>入账最新持仓市值:</span>
                        <span className="font-bold text-slate-800">
                          ¥{(derivedShares * refNetValue).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-10 text-slate-400">
                        <span>今日预估盈亏:</span>
                        <span className="font-semibold text-slate-500">
                          ¥{(entryMode === 'newBuy' ? 0 : derivedShares * (refNetValue - lastNetValue)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-10 text-slate-400 py-1">
                      (暂无该基金的最新有效净值，保存后刷新即可自动计算并对齐份额)
                    </div>
                  )}
                  {!isCostValid && (
                    <p className="mt-2 text-rose-600 font-bold text-xs font-sans">警告：当前输入计算出的成本为负数，请修正金额！</p>
                  )}
                </div>
              )}
            </div>

            {/* 7. 高级选填：收益校准 */}
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(prev => !prev)}
                className="flex items-center gap-1.5 text-11 font-bold text-slate-400 hover:text-slate-600 transition-colors py-1.5 group"
              >
                {showAdvanced ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />}
                <span>高级选填 · 收益校准</span>
              </button>
              {showAdvanced && (
                <div className="mt-1 bg-slate-50/60 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="fund-weekly-profit" className="block text-10 font-bold text-slate-500 mb-1">本周收益 (元)</label>
                      <input
                        id="fund-weekly-profit"
                        type="number"
                        step="0.01"
                        value={fundForm.weeklyProfit ?? ''}
                        onChange={(e) => setFundForm({ ...fundForm, weeklyProfit: e.target.value })}
                        placeholder="选填"
                        className="add-fund-number-input w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm text-slate-800 bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="fund-monthly-profit" className="block text-10 font-bold text-slate-500 mb-1">本月收益 (元)</label>
                      <input
                        id="fund-monthly-profit"
                        type="number"
                        step="0.01"
                        value={fundForm.monthlyProfit ?? ''}
                        onChange={(e) => setFundForm({ ...fundForm, monthlyProfit: e.target.value })}
                        placeholder="选填"
                        className="add-fund-number-input w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm text-slate-800 bg-white transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-9 text-slate-400 leading-relaxed">
                    如需手动校准本周或本月的持仓收益，可在此录入。该值不会被系统自动刷新覆盖。
                  </p>
                </div>
              )}
            </div>
          </>

        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all">取消</button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-[0.98]"
          >
            保存持仓
          </button>
        </div>
      </form>
    </Modal>
  );
}
