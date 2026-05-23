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
  const amountRef = React.useRef(null);

  const selectedType = syncForm.type || '买入';
  const confirmTime = syncForm.confirmTime || 'before15';
  const amountVal = Number.parseFloat(syncForm.amount) || 0;
  const feeVal = Number.parseFloat(syncForm.fee) || 0;

  React.useEffect(() => {
    if (isOpen && syncForm.code) {
      const timer = setTimeout(() => {
        amountRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, syncForm.code]);

  React.useEffect(() => {
    if (selectedType === '买入' && syncForm.feeRate && syncForm.amount) {
      const rateCleaned = String(syncForm.feeRate).replace(/%/g, '').trim();
      const rateVal = Number.parseFloat(rateCleaned);
      const amountVal = Number.parseFloat(syncForm.amount);
      if (Number.isFinite(rateVal) && Number.isFinite(amountVal) && amountVal > 0) {
        const rateFactor = rateVal / 100;
        const calculatedFee = amountVal - (amountVal / (1 + rateFactor));
        
        onChange(prev => {
          const currentFeeVal = Number.parseFloat(prev.fee);
          const diff = Math.abs((currentFeeVal || 0) - calculatedFee);
          if (!prev.fee || diff < 0.5) {
            return {
              ...prev,
              fee: calculatedFee.toFixed(2),
            };
          }
          return prev;
        });
      }
    } else if (selectedType === '卖出') {
      onChange(prev => {
        if (prev.fee === undefined || prev.fee === '') {
          return { ...prev, fee: '0' };
        }
        return prev;
      });
    }
  }, [syncForm.amount, selectedType, syncForm.feeRate, onChange]);

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
              ref={amountRef}
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
            <label htmlFor="sync-fee" className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center justify-between">
              <span>交易手续费 (元)</span>
              {selectedType === '买入' && syncForm.feeRate && (
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                  折算费率: {syncForm.feeRate}
                </span>
              )}
            </label>
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
