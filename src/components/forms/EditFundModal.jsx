import React from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../common/Modal';

export default function EditFundModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editForm,
  setEditForm,
  toNumber,
}) {
  const currentNetValue = toNumber(editForm.currentNetValue);
  const lastNetValue = toNumber(editForm.lastNetValue);
  const refNetValue = currentNetValue > 0 ? currentNetValue : (lastNetValue > 0 ? lastNetValue : 0);

  const amountVal = toNumber(editForm.amount);
  const holdingProfitVal = toNumber(editForm.holdingProfit);
  const derivedCostAmount = amountVal - holdingProfitVal;
  const isCostValid = derivedCostAmount >= 0;

  const derivedShares = refNetValue > 0 ? amountVal / refNetValue : (toNumber(editForm.shares) || 0);
  const derivedCostPrice = derivedShares > 0 ? (Math.max(0, derivedCostAmount) / derivedShares).toFixed(4) : '--';

  const canSubmit = amountVal > 0 && isCostValid;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="持仓配置与对齐" maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        
        {/* 1. 基金核心标题 */}
        <div className="border-b border-slate-100 pb-2 mb-3">
          <h3 className="text-sm font-extrabold text-slate-800 truncate">{editForm.name || '基金配置'}</h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            代码: {editForm.code} · 分组: {editForm.sector || '默认板块'}
          </p>
        </div>

        {/* 2. 可编辑区域：当前持有金额 与 持有收益 */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="edit-amount" className="block text-xs font-bold text-slate-500 mb-1">当前持有金额 (元)</label>
            <input
              id="edit-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={editForm.amount ?? ''}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-profit" className="block text-xs font-bold text-slate-500 mb-1">当前累计收益 (元)</label>
            <input
              id="edit-profit"
              type="number"
              step="0.01"
              required
              value={editForm.holdingProfit ?? ''}
              onChange={(e) => setEditForm({ ...editForm, holdingProfit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* 3. 财务折算看板 */}
        {amountVal > 0 && (
          <div className={`p-3 rounded-xl text-xs font-mono border ${isCostValid ? 'border-slate-100 bg-slate-50/50 text-slate-500' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>
            <div className="flex justify-between py-0.5">
              <span>折算参考份额:</span>
              <span className="font-extrabold text-slate-700">
                {derivedShares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份 {refNetValue > 0 && `(最新净值: ¥${refNetValue.toFixed(4)})`}
              </span>
            </div>
            <div className="flex justify-between py-0.5 mt-0.5">
              <span>持仓本金 & 成本价:</span>
              <span className="font-extrabold text-slate-700">
                ¥{Math.max(0, derivedCostAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })} (¥{derivedCostPrice}/份)
              </span>
            </div>
            {!isCostValid && (
              <p className="mt-1.5 text-[11px] font-bold text-rose-600 font-sans">⚠️ 错误：持有金额小于累计收益，成本本金不可为负！</p>
            )}
          </div>
        )}

        {/* 4. 历史收益数据手动对齐 */}
        <div className="grid grid-cols-2 gap-3.5 pt-1">
          <div>
            <label htmlFor="edit-weekly-profit" className="block text-[10px] font-bold text-slate-400 mb-1">本周收益 (元, 选填)</label>
            <input
              id="edit-weekly-profit"
              type="number"
              step="0.01"
              value={editForm.weeklyProfit ?? ''}
              onChange={(e) => setEditForm({ ...editForm, weeklyProfit: e.target.value })}
              placeholder="留空自动核算"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono text-xs text-slate-700 bg-white"
            />
          </div>
          <div>
            <label htmlFor="edit-monthly-profit" className="block text-[10px] font-bold text-slate-400 mb-1">本月收益 (元, 选填)</label>
            <input
              id="edit-monthly-profit"
              type="number"
              step="0.01"
              value={editForm.monthlyProfit ?? ''}
              onChange={(e) => setEditForm({ ...editForm, monthlyProfit: e.target.value })}
              placeholder="留空自动核算"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none font-mono text-xs text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* 5. 底部操作栏 */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-5">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition-all text-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" /> 删除持仓
          </button>
          
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg font-bold transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-150 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg font-bold transition-all shadow-sm hover:shadow cursor-pointer"
            >
              确认保存
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
