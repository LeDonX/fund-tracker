import React, { useEffect, useState } from 'react';
import { Trash2, AlertCircle, TrendingUp, Info, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const currentNetValue = toNumber(editForm.currentNetValue);
  const lastNetValue = toNumber(editForm.lastNetValue);
  const refNetValue = currentNetValue > 0 ? currentNetValue : (lastNetValue > 0 ? lastNetValue : 0);

  // 获取和验证当前的输入数字
  const amountVal = toNumber(editForm.amount);
  const holdingProfitVal = toNumber(editForm.holdingProfit);
  const derivedCostAmount = amountVal - holdingProfitVal;
  const isCostValid = derivedCostAmount >= 0;

  // 根据当前输入的金额与收益，以及基金最新可用净值，在只读看板里自动显示折算出的份额
  const derivedShares = refNetValue > 0 ? amountVal / refNetValue : (toNumber(editForm.shares) || 0);
  const derivedCostPrice = derivedShares > 0 ? (Math.max(0, derivedCostAmount) / derivedShares).toFixed(4) : '--';

  const canSubmit = amountVal > 0 && isCostValid;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑基金资产信息" maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* 1. 基金只读核心展示区 (Glassmorphic Card) */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">正在编辑的基金</p>
          <h3 className="text-base font-black truncate">{editForm.name || '示例基金'}</h3>
          <div className="flex gap-4 mt-2.5 text-xs font-mono text-slate-300">
            <div>
              <span className="opacity-60 text-[10px] block">基金代码</span>
              <span className="font-bold">{editForm.code}</span>
            </div>
            <div className="w-px bg-slate-800 h-6 align-middle self-center"></div>
            <div>
              <span className="opacity-60 text-[10px] block">所属分组</span>
              <span className="font-bold text-blue-300">{editForm.sector || '默认分组'}</span>
            </div>
            {refNetValue > 0 && (
              <>
                <div className="w-px bg-slate-800 h-6 align-middle self-center"></div>
                <div>
                  <span className="opacity-60 text-[10px] block">最新参考净值</span>
                  <span className="font-bold text-emerald-400">¥{refNetValue.toFixed(4)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2. 可编辑区域：当前持有金额 与 持有收益 */}
        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4 shadow-inner">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>持仓市值及累计盈亏对齐</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-amount" className="block text-xs font-extrabold text-slate-600 mb-1.5">当前持有金额 (元)</label>
              <input
                id="edit-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={editForm.amount ?? ''}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
              />
              <p className="text-[9px] text-slate-400 mt-1">即最新账户确认市值</p>
            </div>
            <div>
              <label htmlFor="edit-profit" className="block text-xs font-extrabold text-slate-600 mb-1.5">当前累计收益 (元)</label>
              <input
                id="edit-profit"
                type="number"
                step="0.01"
                required
                value={editForm.holdingProfit ?? ''}
                onChange={(e) => setEditForm({ ...editForm, holdingProfit: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-slate-800 bg-white"
              />
              <p className="text-[9px] text-slate-400 mt-1">历史持股至今的总盈亏</p>
            </div>
          </div>
        </div>

        {/* 3. 财务折算核算明细看板 */}
        {amountVal > 0 && (
          <div className={`rounded-xl border p-4 text-xs font-medium font-mono space-y-1.5 ${isCostValid ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <div className="font-extrabold text-slate-700 flex items-center gap-1 mb-2 font-sans">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>资产财务重折算分析</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5 mb-1.5">
              <span>持仓本金 (对齐):</span>
              <span className="font-bold text-slate-800">
                ¥{Math.max(0, derivedCostAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5 mb-1.5">
              <span>折算参考份额:</span>
              <span className="font-bold text-slate-800">
                {derivedShares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>折算持仓成本价:</span>
              <span className="font-bold text-slate-700">¥{derivedCostPrice} / 份</span>
            </div>
            {!isCostValid && (
              <p className="mt-2 text-rose-600 font-bold text-xs font-sans">警告：当前输入会导致成本总额为负数，无法保存！</p>
            )}
          </div>
        )}

        {/* 高级选填：收益校准 */}
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(prev => !prev)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-1.5 group"
          >
            {showAdvanced ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />}
            <span>高级选填 · 收益校准</span>
          </button>
          {showAdvanced && (
            <div className="mt-1 bg-slate-50/60 border border-slate-150 p-4 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-weekly-profit" className="block text-[10px] font-bold text-slate-500 mb-1">本周收益 (元)</label>
                  <input
                    id="edit-weekly-profit"
                    type="number"
                    step="0.01"
                    value={editForm.weeklyProfit ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, weeklyProfit: e.target.value })}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm text-slate-800 bg-white transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="edit-monthly-profit" className="block text-[10px] font-bold text-slate-500 mb-1">本月收益 (元)</label>
                  <input
                    id="edit-monthly-profit"
                    type="number"
                    step="0.01"
                    value={editForm.monthlyProfit ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, monthlyProfit: e.target.value })}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-sm text-slate-800 bg-white transition-all"
                  />
                </div>
              </div>
              <p className="text-[9px] text-slate-400 leading-relaxed">
                如需手动校准本周或本月的持仓收益，可在此录入。该值不会被系统自动刷新覆盖。
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition-all text-xs"
          >
            <Trash2 className="w-4 h-4" /> 删除持仓
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all">取消</button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-sm hover:shadow"
            >
              保存更改
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
