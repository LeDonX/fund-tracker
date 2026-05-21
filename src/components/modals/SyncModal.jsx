import React from 'react';
import { Cloud, RefreshCw, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import Modal from '../common/Modal';

export default function SyncModal({
  isOpen,
  onClose,
  onMerge,
  onOverwrite,
  syncStatus, // 'idle', 'syncing', 'success', 'error'
  localFundsCount = 0,
  localTxsCount = 0,
}) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={syncStatus === 'syncing' ? undefined : onClose} title="云端数据同步" maxWidth="max-w-lg">
      <div className="space-y-6">
        {/* Animated Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 text-white shadow-lg">
          <div className="absolute -right-10 -bottom-10 opacity-15">
            <Cloud className="w-40 h-40 animate-pulse" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-bold">检测到未同步的本地持仓</h4>
              <p className="text-xs text-white/80 mt-1">您已登录系统，我们发现您的浏览器中存有本地离线数据。请选择如何处理。</p>
            </div>
          </div>
        </div>

        {/* Local Data Stats Summary */}
        <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 text-sm">
          <div className="flex-1">
            <div className="text-slate-400 text-xs uppercase font-semibold tracking-wider">本地基金持仓</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{localFundsCount} 只</div>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="flex-1 pl-4">
            <div className="text-slate-400 text-xs uppercase font-semibold tracking-wider">本地交易记录</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{localTxsCount} 笔</div>
          </div>
        </div>

        {/* Dynamic Status View */}
        {syncStatus === 'syncing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">正在与 Cloudflare D1 数据库同步中...</p>
            <p className="text-xs text-slate-400">正在打包并安全上传您的交易账单</p>
          </div>
        )}

        {syncStatus === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="p-3 bg-emerald-50 rounded-full">
              <CheckCircle className="w-10 h-10 text-emerald-500 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-slate-700">同步成功！</p>
            <p className="text-xs text-slate-400">您的自选列表与交易流水已成功备份到云端</p>
          </div>
        )}

        {syncStatus === 'error' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="p-3 bg-rose-50 rounded-full">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">同步遇到错误</p>
            <p className="text-xs text-rose-400">请检查您的网络连接并重试</p>
          </div>
        )}

        {syncStatus === 'idle' && (
          <div className="space-y-4">
            {/* Option 1: Merge */}
            <button
              type="button"
              onClick={onMerge}
              className="w-full flex items-start text-left p-4 rounded-xl border border-indigo-100 hover:border-indigo-300 bg-indigo-50/20 hover:bg-indigo-50/40 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600 mt-1 flex-shrink-0 group-hover:scale-105 transition-transform">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-950 text-sm">合并本地数据至云端 (推荐)</span>
                  <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-xs text-indigo-700/80 mt-1.5 leading-relaxed">
                  将您的本地自选基金和交易记录与云端数据库进行智能合并，不丢失任何数据，并自动转为云端托管。
                </p>
              </div>
            </button>

            {/* Option 2: Overwrite */}
            <button
              type="button"
              onClick={onOverwrite}
              className="w-full flex items-start text-left p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600 mt-1 flex-shrink-0 group-hover:scale-105 transition-transform">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 text-sm">覆盖本地，采用云端数据</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  直接放弃本地离线修改，完全拉取并使用已保存在 Cloudflare D1 云数据库中的持仓与交易数据。
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {syncStatus === 'idle' && (
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
          >
            暂不同步 (进入游客模式)
          </button>
        </div>
      )}
    </Modal>
  );
}
