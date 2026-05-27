import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  FileText,
  Clock
} from 'lucide-react';
import Modal from '../common/Modal';
import FormatNumber from '../common/FormatNumber';

export default function HistoryModal({
  isOpen,
  onClose,
  selectedFund,
  transactions,
  formatCurrencyAmount,
  formatDateTimeLabel,
  renderShareDelta,
  toNumber,
}) {
  // Calculate summary metrics
  const buyTransactions = transactions.filter(t => t.type === '买入');
  const sellTransactions = transactions.filter(t => t.type === '卖出');

  const totalBuyAmount = buyTransactions.reduce((sum, t) => sum + (toNumber(t.amount) || 0), 0);
  const totalSellAmount = sellTransactions.reduce((sum, t) => sum + (toNumber(t.amount) || 0), 0);
  const totalFee = transactions.reduce((sum, t) => sum + (toNumber(t.fee) || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${selectedFund?.name || '基金'} · 交易记录流水`} maxWidth="max-w-lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1 -mr-1">
        
        {/* 1. 基金基础信息及代码 */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
              {selectedFund?.code}
            </span>
            <span className="text-slate-500 font-medium">当前市值:</span>
            <span className="text-slate-800 font-extrabold">{formatCurrencyAmount(selectedFund?.amount)}</span>
          </div>
          {toNumber(selectedFund?.shares) > 0 && (
            <div className="text-slate-500 font-medium">
              当前持仓: <span className="text-slate-800 font-extrabold">{toNumber(selectedFund?.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份</span>
            </div>
          )}
        </div>

        {/* 2. 统计卡片面板 */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-rose-50/40 border border-rose-100 p-2.5 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="text-10 font-bold text-rose-600/90 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
              累计加仓
            </span>
            <span className="text-sm font-extrabold text-rose-700 mt-1 font-mono">
              ¥{totalBuyAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="text-10 font-bold text-emerald-600/90 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              累计减仓
            </span>
            <span className="text-sm font-extrabold text-emerald-700 mt-1 font-mono">
              ¥{totalSellAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-blue-50/40 border border-blue-100 p-2.5 rounded-2xl flex flex-col justify-between shadow-sm">
            <span className="text-10 font-bold text-blue-600/90 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              交易笔数
            </span>
            <span className="text-sm font-extrabold text-blue-700 mt-1 font-mono">
              {transactions.length} 笔
            </span>
          </div>
        </div>

        {/* 累计手续费提示 */}
        {totalFee > 0 && (
          <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-10 text-slate-500 flex items-center gap-1.5 font-bold font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>累计交易手续费：¥{totalFee.toFixed(2)}</span>
          </div>
        )}

        {/* 3. 动态时间轴流水 */}
        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">历史记录明细</h4>
          
          {transactions.length === 0 ? (
            <div className="bg-slate-50 text-center py-10 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              暂无真实交易记录，可通过“同步交易”开始积累历史。
            </div>
          ) : (
            <div className="relative pl-5 border-l-2 border-slate-100 space-y-4 py-1 ml-2.5">
              {transactions.map((record) => {
                const isBuy = record.type === '买入';
                return (
                  <div key={record.id} className="relative">
                    {/* 时间轴上的指示节点 */}
                    <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                      isBuy 
                        ? 'border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)]' 
                        : 'border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${isBuy ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    </div>

                    {/* 流水明细卡片 */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow transition-all hover:border-slate-300">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-9 font-black tracking-wide ${
                              isBuy ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}>
                              {isBuy ? '加仓' : '减仓'}
                            </span>
                            <span className="text-11 font-bold text-slate-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {record.tradeDate || '--'}
                            </span>
                          </div>
                          
                          {/* 交易金额 */}
                          <div className={`text-base font-black mt-1 font-mono ${isBuy ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isBuy ? '+' : '-'}¥{record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {/* 额外说明/备注/来源 */}
                        <div className="text-right">
                          <span className="text-9 text-slate-400 font-medium block">登记时间 {formatDateTimeLabel(record.createdAt)}</span>
                          {record.fee > 0 && (
                            <span className="inline-block bg-slate-100 text-slate-500 border border-slate-200 text-9 px-1 py-0.5 rounded mt-1 font-bold font-mono">
                              手续费 ¥{toNumber(record.fee).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 卡片内部指标栅格 */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-10">
                        <div>
                          <span className="text-slate-400 block text-9 font-bold uppercase tracking-wider">参考净值</span>
                          <span className="font-extrabold text-slate-700 font-mono mt-0.5 block">
                            {Number.isFinite(record.referenceNetValue) 
                              ? record.referenceNetValue.toLocaleString('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) 
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-9 font-bold uppercase tracking-wider">份额变动</span>
                          <span className="mt-0.5 block">
                            {renderShareDelta(record.sharesDelta)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-9 font-bold uppercase tracking-wider">成本本金变动</span>
                          <span className="mt-0.5 block font-mono">
                            <FormatNumber value={record.costDelta} isCurrency={true} />
                          </span>
                        </div>
                      </div>

                      {/* 备注面板 */}
                      {record.note && (
                        <div className="mt-2.5 bg-slate-50 border border-slate-200 p-2 rounded-lg text-10 text-slate-500 flex items-start gap-1.5 font-medium leading-relaxed">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>{record.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
