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
  sectors,
  toNumber,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="编辑持仓信息" maxWidth="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700 mb-1">基金名称</label>
          <input
            id="edit-name"
            type="text"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-code" className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
            <input
              id="edit-code"
              type="text"
              required
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
              readOnly
            />
          </div>
          <div>
            <label htmlFor="edit-sector" className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
            <select
              id="edit-sector"
              value={editForm.sector}
              onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="edit-market-value" className="block text-sm font-medium text-slate-700 mb-1">持有金额校准 (元)</label>
          <input
            id="edit-market-value"
            type="number"
            min="0"
            step="0.01"
            required
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">如当前持有金额不准，可在此处覆盖，系统会按最新可用净值反推份额。</p>
          {toNumber(editForm.shares) > 0 && (
            <p className="text-xs text-slate-400 mt-1">当前记录份额：{toNumber(editForm.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份</p>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" /> 删除该持仓
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">保存更改</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
