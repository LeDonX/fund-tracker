import React from 'react';
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${selectedFund?.name || '基金'} - 交易记录`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-slate-500">基金代码: {selectedFund?.code}</span>
          <span className="text-slate-500">交易笔数: <span className="font-medium text-slate-800">{transactions.length}</span></span>
        </div>
        <div className="text-xs text-slate-400 -mt-2 flex items-center justify-between gap-3">
          <span>
            当前市值：{formatCurrencyAmount(selectedFund?.amount)}
          </span>
          {toNumber(selectedFund?.shares) > 0 && (
            <span>
              当前持有份额：{toNumber(selectedFund?.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份
            </span>
          )}
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="p-3 font-medium">日期</th>
                <th className="p-3 font-medium">类型</th>
                <th className="p-3 font-medium text-right">金额(元)</th>
                <th className="p-3 font-medium text-right">参考净值</th>
                <th className="p-3 font-medium text-right">份额变化</th>
                <th className="p-3 font-medium text-right">成本变化</th>
                <th className="p-3 font-medium text-right">记录时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    暂无真实交易记录，可通过“同步交易”开始积累历史。
                  </td>
                </tr>
              )}
              {transactions.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{record.tradeDate || '--'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      record.type === '买入' ? 'bg-blue-100 text-blue-700' :
                      record.type === '卖出' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium text-slate-800">
                    {record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right text-slate-600">
                    {Number.isFinite(record.referenceNetValue) ? record.referenceNetValue.toLocaleString('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '--'}
                  </td>
                  <td className="p-3 text-right">
                    {renderShareDelta(record.sharesDelta)}
                  </td>
                  <td className="p-3 text-right">
                    <FormatNumber value={record.costDelta} isCurrency={true} />
                  </td>
                  <td className="p-3 text-right text-slate-500 whitespace-nowrap">
                    {formatDateTimeLabel(record.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
