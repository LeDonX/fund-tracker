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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Info,
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
  handleOpenSyncTrade,
  todayStr, // Add this prop
}) {
  const actualTodayStr = todayStr || (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const hasCustomGroups = sectors.some((sector) => sector !== ungroupedSector);
  const [openGroupMenu, setOpenGroupMenu] = useState('');
  const groupMenuRef = useRef(null);

  const [sortField, setSortField] = useState(null); // 'name' | 'amount' | 'dailyRate' | 'dailyProfit' | 'totalRate' | 'totalProfit' | 'weeklyProfit' | 'monthlyProfit'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortedFunds = (fundsList) => {
    if (!sortField) return fundsList;

    return [...fundsList].sort((a, b) => {
      let valA, valB;

      switch (sortField) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          return sortDirection === 'asc'
            ? valA.localeCompare(valB, 'zh-CN')
            : valB.localeCompare(valA, 'zh-CN');

        case 'amount':
          valA = toNumber(a.amount) || 0;
          valB = toNumber(b.amount) || 0;
          break;

        case 'dailyRate':
          valA = toNumber(a.dailyRate) || 0;
          valB = toNumber(b.dailyRate) || 0;
          break;

        case 'dailyProfit':
          valA = toNumber(a.dailyProfit) || 0;
          valB = toNumber(b.dailyProfit) || 0;
          break;

        case 'totalRate':
          valA = toNumber(a.totalRate) || 0;
          valB = toNumber(b.totalRate) || 0;
          break;

        case 'totalProfit':
          valA = toNumber(a.totalProfit) || 0;
          valB = toNumber(b.totalProfit) || 0;
          break;

        case 'weeklyProfit':
          valA = toNumber(a.weeklyProfit) || 0;
          valB = toNumber(b.weeklyProfit) || 0;
          break;

        case 'monthlyProfit':
          valA = toNumber(a.monthlyProfit) || 0;
          valB = toNumber(b.monthlyProfit) || 0;
          break;

        default:
          return 0;
      }

      if (valA === valB) {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, 'zh-CN');
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  };

  const renderSortableHeader = (field, label, alignment = 'right') => {
    const isSorted = sortField === field;
    const isAsc = sortDirection === 'asc';

    let thClass = "p-4 font-semibold text-slate-600 cursor-pointer select-none transition-all duration-200 group ";
    if (alignment === 'right') {
      thClass += "text-right";
    } else if (alignment === 'center') {
      thClass += "text-center";
    } else {
      thClass += "text-left";
    }

    if (field === 'dailyProfit') {
      thClass += " bg-blue-50/40 hover:bg-blue-50 text-blue-900";
    } else {
      thClass += " bg-slate-50/40 hover:bg-slate-100/70 text-slate-700";
    }

    return (
      <th
        className={thClass}
        onClick={() => handleSort(field)}
        title={`点击按 ${label} 排序`}
      >
        <div className={`flex items-center gap-1.5 ${alignment === 'right' ? 'justify-end' : alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
          {alignment === 'right' && (
            <div className="shrink-0 flex items-center justify-center">
              {isSorted ? (
                isAsc ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 animate-in fade-in zoom-in-75 duration-200" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 animate-in fade-in zoom-in-75 duration-200" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-90 group-hover:scale-100" />
              )}
            </div>
          )}
          <span className="font-semibold tracking-tight text-xs">{label}</span>
          {alignment !== 'right' && (
            <div className="shrink-0 flex items-center justify-center">
              {isSorted ? (
                isAsc ? <ArrowUp className="w-3.5 h-3.5 text-blue-600 animate-in fade-in zoom-in-75 duration-200" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600 animate-in fade-in zoom-in-75 duration-200" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-90 group-hover:scale-100" />
              )}
            </div>
          )}
        </div>
      </th>
    );
  };

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
    <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-md border border-slate-200/60 flex flex-col min-h-[300px] overflow-hidden">
      {/* 移动端排序栏 */}
      <div className="flex md:hidden items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 shrink-0">
        <span className="text-xs font-bold text-slate-500">持仓排序</span>
        <div className="flex items-center gap-2">
          <select
            value={sortField || ''}
            onChange={(e) => {
              const field = e.target.value;
              if (!field) {
                setSortField(null);
              } else {
                setSortField(field);
                setSortDirection('desc');
              }
            }}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 outline-none text-slate-700 font-semibold cursor-pointer shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
          >
            <option value="">默认 (分组排序)</option>
            <option value="name">基金名称</option>
            <option value="amount">持有金额</option>
            <option value="dailyRate">当日涨幅</option>
            <option value="dailyProfit">当日收益</option>
            <option value="totalRate">持有收益率</option>
            <option value="totalProfit">持有总收益</option>
            <option value="weeklyProfit">本周收益</option>
            <option value="monthlyProfit">本月收益</option>
          </select>
          {sortField && (
            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center justify-center p-1 bg-white border border-slate-200 rounded-lg text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 transition-all w-7 h-7"
            >
              {sortDirection === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto relative custom-scrollbar pb-24 md:pb-0">
        {/* --- 移动端卡片视图 --- */}
        <div className="md:hidden flex flex-col divide-y divide-slate-100">
          {orderedGroups.map(({ sector, data }) => {
            const isCollapsed = collapsedGroups.has(sector);
            const canManageGroup = sector !== ungroupedSector;
            const isMenuOpen = openGroupMenu === sector;

            return (
              <div key={sector} className="flex flex-col">
                {/* 分组头部 */}
                <div className="flex flex-col xs:flex-row xs:items-center justify-between w-full p-3 gap-2 border-l-4 border-indigo-600 bg-slate-50/80 border-b border-slate-200 select-none">
                  <button
                    type="button"
                    className="group/btn flex items-center gap-2 text-left flex-1"
                    onClick={() => toggleGroup(sector)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <Wallet className="w-4.5 h-4.5 text-indigo-500/80" />
                    <span className="font-bold text-slate-700 text-sm tracking-tight truncate max-w-[120px]">{sector}</span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full shrink-0">
                      {data.funds.length} 支
                    </span>
                  </button>
                  
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] pl-6 xs:pl-0 shrink-0">
                    <span className="text-slate-500 font-medium">
                      金额: <span className="font-bold text-slate-800">{formatCurrencyAmount(data.sectorAmount)}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 font-medium flex items-center">
                      盈亏:&nbsp;
                      <span className="font-bold">
                        <FormatNumber value={data.sectorDailyProfit} isCurrency={true} />
                      </span>
                    </span>
                    {canManageGroup && (
                      <div className="relative ml-1" ref={isMenuOpen ? groupMenuRef : null} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setOpenGroupMenu((current) => (current === sector ? '' : sector))}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-all border border-slate-200 bg-white shadow-sm"
                        >
                          <Ellipsis className="w-3.5 h-3.5" />
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-0 top-7 z-20 min-w-[110px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenGroupMenu('');
                                handleEditGroup(sector);
                              }}
                              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" /> 编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenGroupMenu('');
                                handleDeleteGroup(sector);
                              }}
                              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 删除
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 基金卡片列表 */}
                {!isCollapsed && data.funds.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 bg-white">
                    该分组下暂无持仓
                  </div>
                )}

                {!isCollapsed && getSortedFunds(data.funds).map((fund) => (
                  <div key={fund.id} className="p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors bg-white flex flex-col">
                    {/* Header row */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleOpenFundDetail(fund)}
                          className="text-left font-semibold text-slate-800 hover:text-blue-700 text-[14.5px] flex items-center gap-1.5 w-full truncate"
                        >
                          <span className="truncate">{fund.name}</span>
                          {fund.netValueDate && fund.netValueDate !== actualTodayStr && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50/70 text-amber-700 border border-amber-200/50 select-none shrink-0 scale-90 origin-left">
                              {fund.netValueDate.slice(5)}
                            </span>
                          )}
                        </button>
                        <span className="text-[10px] text-slate-400 font-semibold font-mono">{fund.code}</span>
                      </div>
                      
                      {fund.valuationSource === 'official' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60 select-none shrink-0 scale-90 origin-right">
                          已更新
                        </span>
                      )}
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2.5 bg-slate-50/60 p-2.5 rounded-xl border border-slate-200/30">
                      <div className="flex flex-col">
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">持有金额</span>
                        <span className="text-xs font-black text-slate-700 font-mono mt-0.5">{formatCurrencyAmount(fund.amount)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">{dailyProfitColumnLabel}</span>
                        <span className="text-xs font-black font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                          <FormatNumber value={fund.dailyProfit} isCurrency={true} />
                          <span className="text-[9.5px] font-semibold text-slate-400">
                            (<FormatNumber value={fund.dailyRate} isPercent={true} />)
                          </span>
                          {fund.netValueDate && fund.netValueDate !== actualTodayStr && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100/60 border border-slate-200/50 px-1 py-0.2 rounded select-none shrink-0" title={`非今日收益 (${fund.netValueDate})`}>
                              {fund.netValueDate.slice(5)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">持有总收益</span>
                        <span className="text-xs font-black font-mono mt-0.5">
                          <FormatNumber value={fund.totalProfit} isCurrency={true} />
                          <span className="text-[9.5px] ml-1 font-semibold text-slate-400">
                            (<FormatNumber value={fund.totalRate} isPercent={true} />)
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">本周/本月收益</span>
                        <span className="text-xs font-black font-mono mt-0.5 flex flex-wrap gap-1 items-center">
                          <FormatNumber value={fund.weeklyProfit} isCurrency={true} />
                          <span className="text-slate-300">/</span>
                          <FormatNumber value={fund.monthlyProfit} isCurrency={true} />
                        </span>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      <button
                        type="button"
                        onClick={() => handleOpenFundDetail(fund)}
                        className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.97] shadow-sm"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>详情</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSyncTrade(fund)}
                        className="flex items-center justify-center gap-0.5 rounded-lg border border-indigo-100 bg-indigo-50/50 py-1.5 text-xs font-bold text-indigo-600 transition-all hover:bg-indigo-100/50 active:scale-[0.97] shadow-sm"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                        <span>同步</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(fund)}
                        className="flex items-center justify-center gap-0.5 rounded-lg border border-purple-100 bg-purple-50/50 py-1.5 text-xs font-bold text-purple-600 transition-all hover:bg-purple-100/50 active:scale-[0.97] shadow-sm"
                      >
                        <History className="w-3.5 h-3.5 text-purple-400" />
                        <span>流水</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSettings(fund)}
                        className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 active:scale-[0.97] shadow-sm"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>设置</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* --- 桌面端表格视图 --- */}
        <table ref={groupTableRef} className="hidden md:table w-full text-left border-collapse min-w-[900px] table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-50/80">
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 shadow-sm">
              {renderSortableHeader('name', '基金名称 (代码)', 'left')}
              {renderSortableHeader('amount', '持有金额')}
              {renderSortableHeader('dailyRate', dailyRateColumnLabel)}
              {renderSortableHeader('dailyProfit', dailyProfitColumnLabel)}
              {renderSortableHeader('totalRate', '持有收益率')}
              {renderSortableHeader('totalProfit', '持有总收益')}
              {renderSortableHeader('weeklyProfit', '本周收益')}
              {renderSortableHeader('monthlyProfit', '本月收益')}
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

                {!isCollapsed && getSortedFunds(data.funds).map((fund) => (
                  <tr 
                    key={fund.id} 
                    className="border-b border-slate-100 hover:bg-slate-50/80 hover:shadow-[inset_4px_0_0_#2563eb] transition-all duration-200 ease-out bg-white" 
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
                          {fund.netValueDate && fund.netValueDate !== actualTodayStr && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50/70 text-amber-700 border border-amber-200/50 select-none scale-[0.9] origin-left shrink-0" title={`非今日数据 (净值日期: ${fund.netValueDate})`}>
                              {fund.netValueDate.slice(5)}
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
                      <div className="flex flex-col items-end">
                        <FormatNumber value={fund.dailyRate} isPercent={true} />
                        {fund.netValueDate && fund.netValueDate !== actualTodayStr && (
                          <span className="text-[9px] font-semibold text-slate-400 mt-0.5" title={`估值日期为 ${fund.netValueDate}`}>
                            {fund.netValueDate.slice(5)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right bg-blue-50/20 font-extrabold text-[15.5px] border-r border-blue-50/10">
                      <div className="flex flex-col items-end">
                        <FormatNumber value={fund.dailyProfit} isCurrency={true} />
                        {fund.netValueDate && fund.netValueDate !== actualTodayStr && (
                          <span className="text-[9px] font-semibold text-slate-400 mt-0.5" title={`收益日期为 ${fund.netValueDate}`}>
                            {fund.netValueDate.slice(5)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.totalRate} isPercent={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.totalProfit} isCurrency={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.weeklyProfit} isCurrency={true} />
                    </td>
                    <td className="p-4 text-right">
                      <FormatNumber value={fund.monthlyProfit} isCurrency={true} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 justify-items-center">
                        <button
                          type="button"
                          onClick={() => handleOpenFundDetail(fund)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-bold text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.97] flex items-center gap-0.5 cursor-pointer leading-tight"
                          title="查看基金详情"
                          data-testid={`detail-entry-${fund.code}`}
                        >
                          <Info className="w-3 h-3 text-slate-400" />
                          <span>详情</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSyncTrade(fund)}
                          className="rounded-md border border-indigo-100 bg-indigo-50/40 px-1.5 py-px text-[10px] font-bold text-indigo-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.97] flex items-center gap-0.5 cursor-pointer leading-tight"
                          title="同步交易 (快速加仓/减仓)"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                          <span>同步</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(fund)}
                          className="rounded-md border border-purple-100 bg-purple-50/40 px-1.5 py-px text-[10px] font-bold text-purple-600 transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 active:scale-[0.97] flex items-center gap-0.5 cursor-pointer leading-tight"
                          title="交易流水记录"
                        >
                          <History className="w-3.5 h-3.5 text-purple-400" />
                          <span>流水</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSettings(fund)}
                          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-bold text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 active:scale-[0.97] flex items-center gap-0.5 cursor-pointer leading-tight"
                          title="持仓设置"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          <span>设置</span>
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
