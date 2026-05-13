import React from 'react';
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
  hasHoldingSharesInput,
  isHoldingSharesValid,
  hasHoldingAmountInput,
  hasHoldingProfitInput,
  isDerivedCostAmountValid,
  derivedCostAmount,
  canSubmitFund,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增基金持仓" maxWidth="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fund-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
          <input
            id="fund-code"
            type="text"
            required
            value={fundForm.code}
            onChange={(e) => handleFundCodeChange(e.target.value)}
            placeholder="如：005827"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="mt-2 space-y-1">
            <p className={`flex items-center gap-2 text-sm ${fundLookup.status === 'success' ? 'text-emerald-700' : fundLookup.status === 'error' ? 'text-rose-700' : fundLookup.status === 'loading' ? 'text-blue-700' : 'text-slate-500'}`}>
              <span className={`h-2 w-2 rounded-full ${fundLookup.status === 'success' ? 'bg-emerald-500' : fundLookup.status === 'error' ? 'bg-rose-500' : fundLookup.status === 'loading' ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
              <span>{fundLookup.message}</span>
            </p>
            <p className="text-xs text-slate-500">基金名称：<span className="font-medium text-slate-700">{fundLookup.quote?.name || '待自动解析'}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fund-sector" className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
            <select
              id="fund-sector"
              required
              value={fundForm.sector}
              onChange={(e) => setFundForm({ ...fundForm, sector: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fund-shares" className="block text-sm font-medium text-slate-700 mb-1">持有份额 (选填)</label>
            <input
              id="fund-shares"
              type="number"
              min="0"
              step="0.01"
              value={fundForm.shares}
              onChange={(e) => setFundForm({ ...fundForm, shares: e.target.value })}
              placeholder="如已知可直接填写"
              className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className={`text-xs mt-1 ${hasHoldingSharesInput && !isHoldingSharesValid ? 'text-rose-600' : 'text-slate-400'}`}>留空则继续按当前可用净值自动换算份额；如填写则以份额为准。</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fund-amount" className="block text-sm font-medium text-slate-700 mb-1">持有金额 / 当前持仓金额 (元)</label>
            <input
              id="fund-amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={fundForm.amount}
              onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })}
              placeholder="当前持仓总金额"
              className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">这里填当前持有金额，已包含累计收益；详情页中的“持有金额”会直接沿用这个展示口径。</p>
          </div>
          <div>
            <label htmlFor="fund-profit" className="block text-sm font-medium text-slate-700 mb-1">持有收益 (元)</label>
            <input
              id="fund-profit"
              type="number"
              step="0.01"
              required
              value={fundForm.holdingProfit}
              onChange={(e) => setFundForm({ ...fundForm, holdingProfit: e.target.value })}
              placeholder="累计持有收益"
              className="add-fund-number-input w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">支持填写负数，系统会据此反推出持仓成本。</p>
          </div>
        </div>
        <div className={`rounded-xl border px-4 py-3 text-sm ${isDerivedCostAmountValid ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <div className="font-medium">自动换算结果</div>
          <p className="mt-1">总成本金额 = 持有金额 - 持有收益 = {Number.isFinite(derivedCostAmount) ? `¥${derivedCostAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}</p>
          {!isDerivedCostAmountValid && hasHoldingAmountInput && hasHoldingProfitInput && (
            <p className="mt-1">当前填写会导致成本金额为负数，暂时不能保存。</p>
          )}
          <p className="mt-1 text-xs text-slate-500">保存后会沿用当前自动口径同步逻辑；若未填写份额，系统会继续按当前可用净值自动换算。</p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
          <button type="submit" disabled={!canSubmitFund} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:bg-slate-300 disabled:hover:bg-slate-300 disabled:cursor-not-allowed">保存持仓</button>
        </div>
      </form>
    </Modal>
  );
}
