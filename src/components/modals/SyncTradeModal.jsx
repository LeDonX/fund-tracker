import React from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';

export default function SyncTradeModal({
  isOpen,
  onClose,
  onSubmit,
  syncForm,
  onChange,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="同步交易记录" maxWidth="max-w-md">
      <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-2 mb-4 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>录入后会按当前自动口径同步份额、持有金额与成本估算，不回算历史日期净值。</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="sync-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码/拼音简写</label>
          <input
            id="sync-code"
            type="text"
            required
            value={syncForm.code}
            onChange={(e) => onChange({ ...syncForm, code: e.target.value })}
            placeholder="输入代码选择现有基金"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sync-type" className="block text-sm font-medium text-slate-700 mb-1">交易类型</label>
            <select
              id="sync-type"
              value={syncForm.type}
              onChange={(e) => onChange({ ...syncForm, type: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="买入">买入 / 申购</option>
              <option value="卖出">卖出 / 赎回</option>
              <option value="分红">分红</option>
            </select>
          </div>
          <div className="flex items-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            当前按最新可用净值换算份额
          </div>
        </div>
        <div>
          <label htmlFor="sync-amount" className="block text-sm font-medium text-slate-700 mb-1">确认金额 (元)</label>
          <input
            id="sync-amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={syncForm.amount}
            onChange={(e) => onChange({ ...syncForm, amount: e.target.value })}
            placeholder="请输入发生金额"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
          <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">确认同步</button>
        </div>
      </form>
    </Modal>
  );
}
