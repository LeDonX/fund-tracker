import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  GripVertical,
  History,
  Pencil,
  Settings,
  Trash2,
  Wallet,
} from 'lucide-react';
import FormatNumber from './common/FormatNumber';

export default function FundTable({
  groupTableRef,
  orderedGroups,
  collapsedGroups,
  toggleGroup,
  formatCurrencyAmount,
  groupDailyLabel,
  toNumber,
  handleOpenFundDetail,
  handleOpenHistory,
  handleOpenSettings,
  handleEditGroup,
  handleDeleteGroup,
  ungroupedSector,
  funds,
  sectors,
  dailyRateColumnLabel,
  dailyProfitColumnLabel,
}) {
  const hasCustomGroups = sectors.some((sector) => sector !== ungroupedSector);
  const [openGroupMenu, setOpenGroupMenu] = useState('');
  const groupMenuRef = useRef(null);

  useEffect(() => {
    if (!openGroupMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (groupMenuRef.current?.contains(event.target)) {
        return;
      }
      setOpenGroupMenu('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [openGroupMenu]);

  return (
    <div className="flex-1 bg-white rounded-3xl shadow-md border border-slate-200/60 flex flex-col min-h-[300px] overflow-hidden">
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <table ref={groupTableRef} className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/80">
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 shadow-sm">
              <th className="p-4 font-semibold text-slate-600 bg-slate-50/40">基金名称 (代码)</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">持有金额</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">{dailyRateColumnLabel}</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-blue-50/40">{dailyProfitColumnLabel}</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">持有收益率</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">持有总收益</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">本周收益</th>
              <th className="p-4 font-semibold text-slate-600 text-right bg-slate-50/40">本月收益</th>
              <th className="p-4 font-semibold text-slate-600 text-center bg-slate-50/40">操作</th>
            </tr>
          </thead>
          {orderedGroups.map(({ sector, data }) => {
            const isCollapsed = collapsedGroups.has(sector);
            const canManageGroup = sector !== ungroupedSector;
            const isMenuOpen = openGroupMenu === sector;

            return (
              <tbody key={sector} data-sector={sector} id={`sector-body-${sector}`}>
                <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-b border-slate-200 group transition-all">
                  <td colSpan={9} className="p-0">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        data-drag-handle
                        className="flex shrink-0 cursor-grab items-center justify-center border-r border-slate-200 px-3 text-slate-400 transition-colors hover:bg-white/80 hover:text-indigo-600 active:cursor-grabbing"
                        aria-label={`拖拽排序分组 ${sector}`}
                        title="拖拽排序"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="flex w-full items-center justify-between px-4 py-3 border-l-4 border-indigo-600 select-none text-left">
                        <button
                          type="button"
                          className="group/btn flex items-center gap-2 text-left transition-all hover:translate-x-0.5"
                          onClick={() => toggleGroup(sector)}
                          aria-expanded={!isCollapsed}
                          aria-controls={`sector-body-${sector}`}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover/btn:text-indigo-600" />
                          )}
                          <Wallet className="w-4.5 h-4.5 text-indigo-500/80" />
                          <span className="font-bold text-slate-700 text-sm tracking-tight">{sector}</span>
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-full">
                            {data.funds.length} 支
                          </span>
                        </button>
                        <div className="flex items-center gap-4 text-xs pr-4">
                          {canManageGroup && (
                            <div className="relative" ref={isMenuOpen ? groupMenuRef : null} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setOpenGroupMenu((current) => (current === sector ? '' : sector))}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-white hover:text-slate-600 hover:scale-105 active:scale-95 shadow-sm border border-slate-200/40 bg-slate-50"
                                title="分组操作"
                                aria-label={`分组 ${sector} 的操作菜单`}
                              >
                                <Ellipsis className="w-3.5 h-3.5" />
                              </button>
                              {isMenuOpen && (
                                <div className="absolute right-0 top-9 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenGroupMenu('');
                                      handleEditGroup(sector);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    <Pencil className="w-4 h-4 text-slate-400" /> 编辑分组
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenGroupMenu('');
                                      handleDeleteGroup(sector);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" /> 删除分组
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <span className="text-slate-500 font-medium">
                            板块持有金额: <span className="font-bold text-slate-800">{formatCurrencyAmount(data.sectorAmount)}{data.hasIncompleteAmount && <span className="ml-0.5 text-amber-500/70 text-[10px] font-bold cursor-help" title="该板块部分基金数据加载中">*</span>}</span>
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500 font-medium">
                            {groupDailyLabel}: <span className="font-bold text-base"><FormatNumber value={data.sectorDailyProfit} isCurrency={true} />{data.hasIncompleteDaily && <span className="ml-0.5 text-amber-500/70 text-[10px] font-bold cursor-help" title="该板块部分基金数据加载中">*</span>}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>

                {!isCollapsed && data.funds.length === 0 && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={9} className="p-6 text-center text-sm text-slate-400 bg-white">
                      该分组下暂无持仓
                    </td>
                  </tr>
                )}

                {!isCollapsed && data.funds.map((fund) => (
                  <tr 
                    key={fund.id} 
                    className="border-b border-slate-100 hover:bg-slate-50/80 hover:shadow-[inset_4px_0_0_#2563eb] hover:translate-x-[1px] transition-all duration-200 ease-out bg-white" 
                    data-testid={`fund-row-${fund.code}`}
                  >
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => handleOpenFundDetail(fund)}
                        className="text-left group/btn"
                        data-testid={`open-fund-detail-${fund.code}`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 transition-colors group-hover/btn:text-blue-700 text-[14.5px]">
                          <span>{fund.name}</span>
                          {fund.valuationSource === 'official' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60 select-none scale-[0.9] origin-left shrink-0">
                              已更新
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="text-xs text-slate-400 mt-0.5 font-medium">
                        {fund.code}
                        {toNumber(fund.shares) > 0 && ` · ${toNumber(fund.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份`}
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-700 text-[14.5px] font-mono">
                      {formatCurrencyAmount(fund.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.dailyRate} isPercent={true} />
                    </td>
                    <td className="p-4 text-right bg-blue-50/20 font-extrabold text-[15.5px] border-r border-blue-50/10">
                      <FormatNumber value={fund.dailyProfit} isCurrency={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.totalRate} isPercent={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.totalProfit} isCurrency={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.weeklyProfit} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.monthlyProfit} />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenFundDetail(fund)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:scale-[1.03] active:scale-[0.97]"
                          title="详情"
                          data-testid={`detail-entry-${fund.code}`}
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(fund)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:scale-[1.08] active:scale-[0.92] rounded-lg transition-all"
                          title="交易记录"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSettings(fund)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:scale-[1.08] active:scale-[0.92] rounded-lg transition-all"
                          title="设置"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      {funds.length === 0 && !hasCustomGroups && (
        <div className="p-12 text-center text-slate-500 absolute inset-0 flex items-center justify-center pointer-events-none mt-10">
          暂无基金持仓数据，请点击上方“新增持仓”添加
        </div>
      )}
    </div>
  );
}
