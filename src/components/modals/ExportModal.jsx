import React from 'react';
import { Download } from 'lucide-react';
import Modal from '../common/Modal';

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  fundsCount,
  sectorsCount,
  transactionsCount,
  detailCacheCount,
  dailyProfitsCount,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="导出基金数据">
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">将导出完整 JSON 数据包，包含当前持仓、分组、详情缓存和真实交易流水，可用于备份或迁移。</p>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">持仓：<span className="font-medium text-slate-800">{fundsCount}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">分组：<span className="font-medium text-slate-800">{sectorsCount}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">交易：<span className="font-medium text-slate-800">{transactionsCount}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">详情缓存：<span className="font-medium text-slate-800">{detailCacheCount}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 col-span-2">收益历史：<span className="font-medium text-slate-800">{dailyProfitsCount} 条</span></div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
        <button type="button" onClick={onExport} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"><Download className="w-4 h-4" /> 导出 JSON</button>
      </div>
    </Modal>
  );
}
