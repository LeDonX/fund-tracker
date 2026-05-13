import React from 'react';
import Modal from '../common/Modal';

export default function GroupModal({
  isOpen,
  onClose,
  onSubmit,
  value,
  onChange,
  mode,
  originalName,
  canDelete,
  onDelete,
}) {
  const isEdit = mode === 'edit';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '编辑分组' : '创建新分组'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-slate-700 mb-1">分组名称</label>
          <input
            id="group-name"
            type="text"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="如：海外QDII、固收+"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {isEdit && originalName && (
            <p className="mt-2 text-xs text-slate-500">当前正在编辑分组：{originalName}</p>
          )}
        </div>
        <div className="flex justify-between gap-3 pt-4">
          <div>
            {canDelete && (
              <button type="button" onClick={onDelete} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors">
                删除分组
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">{isEdit ? '保存分组' : '确认创建'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
