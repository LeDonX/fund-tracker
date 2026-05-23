import React from 'react';
import { Upload } from 'lucide-react';
import Modal from '../common/Modal';

export default function ImportModal({
  isOpen,
  onClose,
  importFileInputRef,
  importState,
  onFileChange,
  onModeChange,
  onConfirm,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="导入基金数据" maxWidth="max-w-lg">
      <div className="space-y-4">
        <input
          ref={importFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/70">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">选择 Fund Tracker JSON 备份文件</p>
          <p className="text-slate-400 text-sm mt-1">第一版仅支持标准 JSON 导入，用于完整恢复或追加数据。</p>
          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" /> 选择 JSON 文件
          </button>
          {importState.fileName && (
            <p className="mt-3 text-xs text-slate-500">当前文件：{importState.fileName}</p>
          )}
        </div>

        {importState.isParsing && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            正在解析导入文件...
          </div>
        )}

        {importState.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {importState.error}
          </div>
        )}

        {importState.preview && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-800">导入预览</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div className="rounded-lg bg-slate-50 px-3 py-2">基金数量：<span className="font-medium text-slate-800">{importState.preview.fundsCount}</span></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">分组数量：<span className="font-medium text-slate-800">{importState.preview.sectorsCount}</span></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">交易流水：<span className="font-medium text-slate-800">{importState.preview.transactionsCount}</span></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">详情缓存：<span className="font-medium text-slate-800">{importState.preview.detailCacheCount}</span></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 col-span-2">收益历史：<span className="font-medium text-slate-800">{importState.preview.dailyProfitsCount ?? 0} 条</span></div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                包来源：{importState.preview.app || '未知'}{Number.isFinite(importState.preview.version) ? ` · 版本 ${importState.preview.version}` : ''}
              </p>
            </div>

            <div>
              <label htmlFor="import-mode" className="block text-sm font-medium text-slate-700 mb-2">导入方式</label>
              <select
                id="import-mode"
                value={importState.mode}
                onChange={(e) => onModeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="replace-all">全量替换当前数据</option>
                <option value="append-funds">仅追加新基金并合并分组/交易</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">
                全量替换会覆盖当前持仓、分组、详情缓存和交易流水；追加模式只导入当前不存在的基金，并合并分组、缓存和交易历史。
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-6">
        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!importState.payload || importState.isParsing}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:bg-slate-300 disabled:hover:bg-slate-300 disabled:cursor-not-allowed"
        >
          开始导入
        </button>
      </div>
    </Modal>
  );
}
