import React from 'react';
import { AlertCircle, ArrowUpRight, ArrowDownRight, Calendar, Info } from 'lucide-react';
import Modal from '../common/Modal';

export default function SyncTradeModal({
  isOpen,
  onClose,
  onSubmit,
  syncForm,
  onChange,
}) {
  const selectedType = syncForm.type || '买入';
  const confirmTime = syncForm.confirmTime || 'before15';
  const amountVal = Number.parseFloat(syncForm.amount) || 0;
  const feeVal = Number.parseFloat(syncForm.fee) || 0;

  const handleTypeChange = (type) => {
    onChange({
      ...syncForm,
      type,
      amount: '',
      fee: '',
    });
  };

  const handleTimeChange = (time) => {
    onChange({
      ...syncForm,
      confirmTime: time,
    });
  };

  const isAmountValid = Number.isFinite(amountVal) && amountVal > 0;
  const isFeeValid = Number.isFinite(feeVal) && feeVal >= 0 && feeVal < amountVal;
  const canSubmit = syncForm.code && isAmountValid && isFeeValid;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="同步与登记交易" maxWidth="max-w-md">
      {/* 财务折算提示 */}
      <div className="bg-slate-50 text-slate-700 p-4 rounded-2xl border border-slate-150 flex items-start gap-2.5 mb-4 text-xs font-medium leading-relaxed shadow-sm">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-extrabold text-slate-800 font-sans">交易智能核算说明：</p>
          <p>
            登记此交易后，系统将使用该时刻的参考净值将交易金额折算为份额，并同步修正您当前的<strong>持有份额</strong>与<strong>持仓成本本金</strong>。
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* 1. 目标基金代码 */}
        <div>
          <label htmlFor="sync-code" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">目标基金代码</label>
          <input
            id="sync-code"
            type="text"
            required
            maxLength={6}
            value={syncForm.code || ''}
            onChange={(e) => onChange({ ...syncForm, code: e.target.value })}
            placeholder="请输入6位基金代码，如：005827"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
          />
        </div>

        {/* 2. 交易方向 Toggle */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">交易类型 (加减仓)</label>
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200/60 shadow-inner">
            <button
              type="button"
              onClick={() => handleTypeChange('买入')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${selectedType === '买入' ? 'bg-white text-rose-600 shadow-sm border border-slate-200/25' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ArrowUpRight className="w-4 h-4 text-rose-500" />
              <span>买入 / 加仓</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('卖出')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg transition-all ${selectedType === '卖出' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/25' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              <span>卖出 / 减仓</span>
            </button>
          </div>
        </div>

        {/* 3. 发生金额 与 手续费 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sync-amount" className="block text-xs font-bold text-slate-600 mb-1.5">发生金额 (元)</label>
            <input
              id="sync-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={syncForm.amount || ''}
              onChange={(e) => onChange({ ...syncForm, amount: e.target.value })}
              placeholder="确认总发生金额"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
            />
          </div>
          <div>
            <label htmlFor="sync-fee" className="block text-xs font-bold text-slate-600 mb-1.5">交易手续费 (元)</label>
            <input
              id="sync-fee"
              type="number"
              min="0"
              step="0.01"
              value={syncForm.fee || ''}
              onChange={(e) => onChange({ ...syncForm, fee: e.target.value })}
              placeholder="手续费，选填"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* 4. 交易日期 */}
        <div>
          <label htmlFor="sync-date" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">交易发生日期</label>
          <input
            id="sync-date"
            type="date"
            required
            value={syncForm.tradeDate || ''}
            onChange={(e) => onChange({ ...syncForm, tradeDate: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-slate-700 bg-white"
          />
        </div>

        {/* 5. 时间 Cutoff Toggle */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">交易确认时段</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTimeChange('before15')}
              className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${confirmTime === 'before15' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>15:00 前</span>
              <span className="text-[9px] opacity-75 font-medium">按所选日期价格折算</span>
            </button>
            <button
              type="button"
              onClick={() => handleTimeChange('after15')}
              className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${confirmTime === 'after15' ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm font-black' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>15:00 后</span>
              <span className="text-[9px] opacity-75 font-medium">按下一个工作日价格折算</span>
            </button>
          </div>
        </div>

        {/* 6. 财务规则动态面板 */}
        {isAmountValid && (
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-[11px] leading-relaxed text-slate-500 flex gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <span>
              {selectedType === '买入' 
                ? `买入操作：持仓本金增加 ¥${amountVal.toFixed(2)}。在扣除手续费 ¥${feeVal.toFixed(2)} 后，剩余 ¥${(amountVal - feeVal).toFixed(2)} 将折算为份额追加进您的持仓。`
                : `卖出操作：卖出资产价值 ¥${amountVal.toFixed(2)}，持仓份额和持仓成本将按比例同步扣减。实际返还您的现金额为 ¥${(amountVal - feeVal).toFixed(2)}（已扣除手续费 ¥${feeVal.toFixed(2)}）。`
              }
            </span>
          </div>
        )}

        {/* 底部按钮栏 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all">取消</button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-sm hover:shadow"
          >
            确认同步
          </button>
        </div>
      </form>
    </Modal>
  );
}
