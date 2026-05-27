import React from 'react';
import { X, Settings, Database, Eye, Upload, Download, Sparkles } from 'lucide-react';

export default function SystemSettingsModal({
  isOpen,
  onClose,
  selectedDataSource,
  setSelectedDataSource,
  showTabProfit,
  setShowTabProfit,
  onOpenImport,
  onOpenExport,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl border border-slate-200/50 p-6 shadow-2xl transition-all select-none animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-500 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">系统参数与设置</h3>
              <p className="text-10 text-slate-400 font-bold mt-0.5">自适应多维度配置中心</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-full hover:bg-slate-100 p-1.5 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-5 mt-5">
          {/* Section 1: Data Settings */}
          <div className="flex flex-col gap-3">
            <span className="text-10 font-black text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>数据与查询配置</span>
            </span>

            {/* DataSource Dropdown */}
            <div className="flex flex-col gap-1.5 bg-slate-50 border border-slate-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-11 font-black text-slate-700">实时行情估值数据源</span>
                <span className="text-9 px-1.5 py-0.5 rounded font-black bg-blue-50 text-blue-600 border border-blue-100">智能引擎</span>
              </div>
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value)}
                className="w-full mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="auto">智能双阶段自动切换 (推荐)</option>
                <option value="tiantian">天天基金实时估值优先</option>
                <option value="eastmoney">东方财富收盘净值优先</option>
              </select>
              <p className="text-[10px] text-slate-400 font-bold leading-normal mt-1 pl-0.5">
                双阶段引擎在交易时间内获取高频估值，闭市后自动切为高精度官方收盘净值。
              </p>
            </div>
          </div>

          {/* Section 2: Display Settings */}
          <div className="flex flex-col gap-3">
            <span className="text-10 font-black text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>显示偏好控制</span>
            </span>

            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 cursor-pointer hover:bg-slate-100/30 transition-all select-none">
              <div className="flex flex-col gap-0.5">
                <span className="text-11 font-black text-slate-700">在页签标题上显示持仓金额</span>
                <span className="text-10 text-slate-400 font-bold">在页面顶端或侧栏标题显示持仓汇总</span>
              </div>
              <input
                type="checkbox"
                checked={showTabProfit}
                onChange={(e) => setShowTabProfit(e.target.checked)}
                className="w-4 h-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Data Import / Export */}
          <div className="flex flex-col gap-3">
            <span className="text-10 font-black text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>数据备份与迁移</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button" 
                onClick={() => { onClose(); onOpenImport(); }}
                className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-2xl transition-all duration-150 text-xs font-bold border border-slate-200 shadow-3xs cursor-pointer active:scale-[0.98]"
              >
                <Upload className="w-4.5 h-4.5 text-slate-500" /> 
                <span>导入备份 (JSON)</span>
              </button>
              <button 
                type="button" 
                onClick={() => { onClose(); onOpenExport(); }}
                className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-2xl transition-all duration-150 text-xs font-bold border border-slate-200 shadow-3xs cursor-pointer active:scale-[0.98]"
              >
                <Download className="w-4.5 h-4.5 text-slate-500" /> 
                <span>导出备份 (JSON)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 pt-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold transition-all duration-150 text-xs shadow-sm cursor-pointer hover:shadow active:scale-[0.98]"
          >
            保存并应用配置
          </button>
        </div>
      </div>
    </div>
  );
}
