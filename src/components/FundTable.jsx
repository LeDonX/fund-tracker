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
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px] overflow-hidden">
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <table ref={groupTableRef} className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider shadow-[0_1px_0_0_#e2e8f0]">
              <th className="p-4 font-medium bg-slate-50">基金名称 (代码)</th>
              <th className="p-4 font-medium text-right bg-slate-50">持有金额</th>
              <th className="p-4 font-medium text-right bg-slate-50">{dailyRateColumnLabel}</th>
              <th className="p-4 font-medium text-right bg-blue-50/80">{dailyProfitColumnLabel}</th>
              <th className="p-4 font-medium text-right bg-slate-50">持有收益率</th>
              <th className="p-4 font-medium text-right bg-slate-50">持有总收益</th>
              <th className="p-4 font-medium text-right bg-slate-50">本周收益</th>
              <th className="p-4 font-medium text-right bg-slate-50">本月收益</th>
              <th className="p-4 font-medium text-center bg-slate-50">操作</th>
            </tr>
          </thead>
          {orderedGroups.map(({ sector, data }) => {
            const isCollapsed = collapsedGroups.has(sector);
            const canManageGroup = sector !== ungroupedSector;
            const isMenuOpen = openGroupMenu === sector;

            return (
              <tbody key={sector} data-sector={sector} id={`sector-body-${sector}`}>
                <tr className="bg-slate-100/70 border-b border-slate-200 group hover:bg-slate-100 transition-colors">
                  <td colSpan={9} className="p-0">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        data-drag-handle
                        className="flex shrink-0 cursor-grab items-center justify-center border-r border-slate-200 px-3 text-slate-400 transition-colors hover:bg-white/80 hover:text-blue-600 active:cursor-grabbing"
                        aria-label={`拖拽排序分组 ${sector}`}
                        title="拖拽排序"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="flex w-full items-center justify-between px-4 py-2.5 border-l-4 border-blue-500 select-none text-left">
                        <button
                          type="button"
                          className="group flex items-center gap-2 text-left"
                          onClick={() => toggleGroup(sector)}
                          aria-expanded={!isCollapsed}
                          aria-controls={`sector-body-${sector}`}
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                          <Wallet className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700 text-sm">{sector}</span>
                          <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {data.funds.length} 支
                          </span>
                        </button>
                        <div className="flex items-center gap-4 text-sm pr-4">
                          {canManageGroup && (
                            <div className="relative" ref={isMenuOpen ? groupMenuRef : null} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setOpenGroupMenu((current) => (current === sector ? '' : sector))}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                                title="分组操作"
                                aria-label={`分组 ${sector} 的操作菜单`}
                              >
                                <Ellipsis className="w-4 h-4" />
                              </button>
                              {isMenuOpen && (
                                <div className="absolute right-0 top-10 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenGroupMenu('');
                                      handleEditGroup(sector);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Pencil className="w-4 h-4" /> 编辑分组
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenGroupMenu('');
                                      handleDeleteGroup(sector);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" /> 删除分组
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <span className="text-slate-500">板块持有金额: <span className="font-medium text-slate-800">{data.hasIncompleteAmount ? '--' : formatCurrencyAmount(data.sectorAmount)}</span></span>
                          <span className="text-slate-500">{groupDailyLabel}: </span>
                          <span className="text-base">
                            <FormatNumber value={data.hasIncompleteDaily ? null : data.sectorDailyProfit} isCurrency={true} />
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
                  <tr key={fund.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors bg-white" data-testid={`fund-row-${fund.code}`}>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => handleOpenFundDetail(fund)}
                        className="text-left"
                        data-testid={`open-fund-detail-${fund.code}`}
                      >
                        <div className="font-medium text-slate-800 transition-colors hover:text-blue-700">{fund.name}</div>
                      </button>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {fund.code}
                        {toNumber(fund.shares) > 0 && ` · ${toNumber(fund.shares).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 份`}
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium text-slate-700">
                      {formatCurrencyAmount(fund.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.dailyRate} isPercent={true} />
                    </td>
                    <td className="p-4 text-right bg-blue-50/10 font-bold text-base">
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
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          title="详情"
                          data-testid={`detail-entry-${fund.code}`}
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(fund)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="交易记录"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSettings(fund)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
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
