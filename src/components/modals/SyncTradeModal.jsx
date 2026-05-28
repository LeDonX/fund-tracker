import React from 'react';
import { 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Info, 
  RefreshCw, 
  Check, 
  Calculator, 
  Coins, 
  Hash, 
  Search, 
  FolderOpen, 
  ArrowRight, 
  Clock, 
  CircleDot 
} from 'lucide-react';
import Modal from '../common/Modal';

export default function SyncTradeModal({
  isOpen,
  onClose,
  onSubmit,
  syncForm,
  onChange,
  sectors = [],
  funds = [],
  syncFundLookup = { status: 'idle', message: '', quote: null },
}) {
  const amountRef = React.useRef(null);

  const selectedType = syncForm.type || '买入';
  const confirmTime = syncForm.confirmTime || 'before15';
  const amountVal = Number.parseFloat(syncForm.amount) || 0;
  const feeVal = Number.parseFloat(syncForm.fee) || 0;

  // 1. 查找匹配的基金以及最新行情
  const selectedFund = funds.find(f => String(f.code || '').trim() === String(syncForm.code || '').trim());
  const isNewFund = syncForm.code && /^\d{6}$/.test(syncForm.code) && !selectedFund;

  const quote = syncFundLookup?.quote || selectedFund;
  const fundName = quote?.name || selectedFund?.name || '';
  
  const lastNetValueVal = Number.parseFloat(quote?.lastNetValue) || Number.parseFloat(quote?.currentNetValue) || 0;
  const estimatedNetValueVal = Number.parseFloat(quote?.estimatedNetValue) || 0;
  const dailyRateVal = Number.parseFloat(quote?.dailyRate) || Number.parseFloat(quote?.estimatedDailyRate) || 0;

  // 2. 计算当前折算用参考净值 (以昨日收盘为首选，今日估算为备选)
  const referenceNetValue = lastNetValueVal > 0 ? lastNetValueVal : (estimatedNetValueVal > 0 ? estimatedNetValueVal : 0);

  // 3. 智能费率计算
  React.useEffect(() => {
    if (isOpen && syncForm.code) {
      const timer = setTimeout(() => {
        amountRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, syncForm.code]);

  React.useEffect(() => {
    if (selectedType === '买入' && syncForm.feeRate && syncForm.amount) {
      const rateCleaned = String(syncForm.feeRate).replace(/%/g, '').trim();
      const rateVal = Number.parseFloat(rateCleaned);
      const amountVal = Number.parseFloat(syncForm.amount);
      if (Number.isFinite(rateVal) && Number.isFinite(amountVal) && amountVal > 0) {
        const rateFactor = rateVal / 100;
        const calculatedFee = amountVal - (amountVal / (1 + rateFactor));
        
        onChange(prev => {
          const currentFeeVal = Number.parseFloat(prev.fee);
          const diff = Math.abs((currentFeeVal || 0) - calculatedFee);
          if (!prev.fee || diff < 0.5) {
            return {
              ...prev,
              fee: calculatedFee.toFixed(2),
            };
          }
          return prev;
        });
      }
    } else if (selectedType === '卖出') {
      onChange(prev => {
        if (prev.fee === undefined || prev.fee === '') {
          return { ...prev, fee: '0' };
        }
        return prev;
      });
    }
  }, [syncForm.amount, selectedType, syncForm.feeRate, onChange]);

  const handleTypeChange = (type) => {
    onChange({
      ...syncForm,
      type,
      amount: '',
      fee: '',
    });
  };

  const handleTimeChange = (time) => {
    onChange({
      ...syncForm,
      confirmTime: time,
    });
  };

  const calculateAmountFromShares = (sharesVal, feeVal) => {
    const sharesNum = Number.parseFloat(sharesVal) || 0;
    const feeNum = Number.parseFloat(feeVal) || 0;
    
    if (sharesNum > 0 && referenceNetValue > 0) {
      return selectedType === '买入'
        ? (sharesNum * referenceNetValue + feeNum).toFixed(2)
        : (sharesNum * referenceNetValue).toFixed(2);
    }
    return '';
  };

  const handleModeSwitch = (mode) => {
    if (mode === 'amount') {
      onChange({
        ...syncForm,
        sharesMode: false,
        amount: '',
        shares: '',
        fee: '',
      });
    } else {
      onChange({
        ...syncForm,
        sharesMode: true,
        amount: '',
        shares: '',
        fee: '',
      });
    }
  };

  const handleSharesChange = (sharesVal) => {
    const computedAmount = calculateAmountFromShares(sharesVal, syncForm.fee);
    onChange({
      ...syncForm,
      shares: sharesVal,
      amount: computedAmount,
    });
  };

  const handleFeeChange = (feeVal) => {
    if (syncForm.sharesMode) {
      const computedAmount = calculateAmountFromShares(syncForm.shares, feeVal);
      onChange({
        ...syncForm,
        fee: feeVal,
        amount: computedAmount,
      });
    } else {
      onChange({
        ...syncForm,
        fee: feeVal,
      });
    }
  };

  // 4. 表单有效性校验
  const isAmountValid = Number.isFinite(amountVal) && amountVal > 0;
  const isFeeValid = Number.isFinite(feeVal) && feeVal >= 0 && feeVal < amountVal;
  const canSubmit = syncForm.code && /^\d{6}$/.test(syncForm.code) && isAmountValid && isFeeValid;

  // 5. 份额与对比变动计算
  const netAmount = selectedType === '买入' ? Math.max(0, amountVal - feeVal) : amountVal;
  const sharesDelta = referenceNetValue > 0 ? netAmount / referenceNetValue : 0;

  const currentShares = selectedFund ? (Number.parseFloat(selectedFund.shares) || 0) : 0;
  const nextShares = selectedType === '买入' ? (currentShares + sharesDelta) : Math.max(0, currentShares - sharesDelta);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="同步与登记交易" maxWidth="max-w-md">
      <form onSubmit={onSubmit} className="space-y-5 px-1.5 pb-2">
        {/* 1. 目标基金代码 & 动态查询 */}
        <div>
          <label htmlFor="sync-code" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span>目标基金代码</span>
          </label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="sync-code"
              type="text"
              required
              maxLength={6}
              value={syncForm.code || ''}
              onChange={(e) => onChange({ ...syncForm, code: e.target.value })}
              placeholder="请输入6位基金代码，如：005827"
              className="w-full pl-11 pr-4 py-3 border border-slate-200/80 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-800 bg-white shadow-2xs transition-all duration-200"
            />
          </div>

          {/* 实时匹配行情状态 (Glassmorphism Stock Ticker Card) */}
          {syncForm.code && /^\d{6}$/.test(syncForm.code) && (
            <div className="mt-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3 animate-in fade-in duration-300">
              {syncFundLookup.status === 'loading' && (
                <div className="flex items-center gap-2.5 text-xs font-bold text-blue-650 py-1.5 px-3.5 bg-blue-50/40 rounded-xl border border-blue-100/50 w-fit">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{syncFundLookup.message}</span>
                </div>
              )}

              {syncFundLookup.status === 'error' && (
                <div className="flex items-start gap-2.5 text-xs font-bold text-rose-650 py-2.5 px-3.5 bg-rose-50/40 rounded-xl border border-rose-100/50">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{syncFundLookup.message}</span>
                </div>
              )}

              {(syncFundLookup.status === 'success' || selectedFund) && quote && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-[10px] font-mono font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg leading-none">{syncForm.code}</span>
                      <span className="text-xs font-black text-slate-800 truncate pr-1">
                        {fundName || '公募基金'}
                      </span>
                    </div>
                    {selectedFund ? (
                      <span className="shrink-0 text-[9px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2.5 py-1 rounded-lg shadow-3xs tracking-wider uppercase flex items-center gap-1.5 leading-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>持有中</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-black bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2.5 py-1 rounded-lg shadow-3xs tracking-wider uppercase leading-none">新仓自动建仓</span>
                    )}
                  </div>
                  
                  {/* 行情卡片 */}
                  <div className={`grid grid-cols-2 gap-3 p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                    dailyRateVal > 0 
                      ? 'bg-gradient-to-br from-rose-50/50 to-orange-50/20 border-rose-100/70' 
                      : dailyRateVal < 0 
                        ? 'bg-gradient-to-br from-emerald-50/50 to-teal-50/20 border-emerald-100/70' 
                        : 'bg-gradient-to-br from-slate-50/80 to-slate-100/30 border-slate-200/50'
                  }`}>
                    {dailyRateVal !== 0 && (
                      <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${dailyRateVal > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-ping'}`} />
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-extrabold block tracking-wide select-none">昨日收盘净值</span>
                      <span className="text-15 font-black text-slate-800 font-mono tracking-tight block">
                        {lastNetValueVal > 0 ? `¥${lastNetValueVal.toFixed(4)}` : '--'}
                      </span>
                    </div>

                    <div className="space-y-1 border-l border-slate-200/60 pl-3.5">
                      <span className="text-[10px] text-slate-400 font-extrabold flex items-center justify-between tracking-wide select-none">
                        <span>今日估算净值</span>
                        {estimatedNetValueVal > 0 && dailyRateVal !== 0 && (
                          <span className={`text-[10px] font-black font-mono shrink-0 px-1.5 py-0.5 rounded-lg border leading-none scale-90 ${
                            dailyRateVal > 0 
                              ? 'text-rose-600 bg-rose-50 border-rose-100/60' 
                              : 'text-emerald-600 bg-emerald-50 border-emerald-100/60'
                          }`}>
                            {dailyRateVal > 0 ? '+' : ''}{dailyRateVal.toFixed(2)}%
                          </span>
                        )}
                      </span>
                      <span className="text-15 font-black text-slate-800 font-mono tracking-tight block">
                        {estimatedNetValueVal > 0 ? `¥${estimatedNetValueVal.toFixed(4)}` : '未开盘'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1.5. 新基金建仓分组选择 */}
        {isNewFund && sectors.length > 0 && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <label htmlFor="sync-sector" className="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>归属持仓分组</span>
            </label>
            <div className="relative">
              <select
                id="sync-sector"
                value={syncForm.sector || '未分组'}
                onChange={(e) => onChange({ ...syncForm, sector: e.target.value })}
                className="w-full pl-4 pr-10 py-3 border border-indigo-200 bg-indigo-50/15 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-extrabold text-slate-700 cursor-pointer shadow-2xs appearance-none transition-all"
              >
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* 2. 交易方向 Toggle */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
            <CircleDot className="w-3.5 h-3.5 text-slate-400" />
            <span>交易类型 (加减仓)</span>
          </label>
          <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1.5 border border-slate-200/40 shadow-inner relative">
            <button
              type="button"
              onClick={() => handleTypeChange('买入')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all duration-205 cursor-pointer border border-transparent ${
                selectedType === '买入' 
                  ? 'bg-white text-rose-600 shadow-sm font-black' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ArrowUpRight className={`w-4 h-4 transition-transform duration-300 ${selectedType === '买入' ? 'scale-110 text-rose-500 animate-pulse' : 'text-slate-400'}`} />
              <span>买入 / 加仓</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('卖出')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl transition-all duration-205 cursor-pointer border border-transparent ${
                selectedType === '卖出' 
                  ? 'bg-white text-emerald-600 shadow-sm font-black' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ArrowDownRight className={`w-4 h-4 transition-transform duration-300 ${selectedType === '卖出' ? 'scale-110 text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
              <span>卖出 / 减仓</span>
            </button>
          </div>
        </div>

        {/* 3. 成交方式与信息登记容器 */}
        <div className="p-4.5 rounded-2xl border border-slate-200/50 bg-slate-50/20 space-y-4 shadow-3xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none mb-1">
            <Coins className="w-3.5 h-3.5 text-slate-400" />
            <span>成交登记方式</span>
          </label>

          {/* 金额/份额 成交方式切换 */}
          <div className="bg-slate-100/60 p-0.5 rounded-xl flex gap-1 border border-slate-200/40 shadow-3xs relative h-[38px] items-center">
            <button
              type="button"
              onClick={() => handleModeSwitch('amount')}
              className={`flex-1 h-[32px] rounded-lg text-xs font-bold flex items-center justify-center transition-all duration-200 cursor-pointer border border-transparent ${
                !syncForm.sharesMode
                  ? 'bg-white text-blue-700 shadow-3xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>金额方式 (登记金额)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('shares')}
              className={`flex-1 h-[32px] rounded-lg text-xs font-bold flex items-center justify-center transition-all duration-200 cursor-pointer border border-transparent ${
                syncForm.sharesMode
                  ? 'bg-white text-blue-700 shadow-3xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>份额方式 (登记份额)</span>
            </button>
          </div>

          {/* 根据成交方式渲染互斥的主输入项 (金额与份额不会同时出现) */}
          <div className="space-y-4">
            {!syncForm.sharesMode ? (
              /* ================= 金额方式主输入 (发生金额 + 手续费) ================= */
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                <div>
                  <label htmlFor="sync-amount" className="block text-[11px] font-bold text-slate-550 mb-1.5 select-none">发生金额 (元)</label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">¥</span>
                    <input
                      id="sync-amount"
                      ref={amountRef}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={syncForm.amount || ''}
                      onChange={(e) => onChange({ ...syncForm, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200/85 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-800 bg-white transition-all shadow-3xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="sync-fee" className="block text-[11px] font-bold text-slate-555 mb-1.5 flex items-center justify-between select-none">
                    <span>交易手续费</span>
                    {selectedType === '买入' && syncForm.feeRate && (
                      <span className="text-[9px] text-indigo-650 font-black bg-indigo-50 border border-indigo-100/50 px-1 py-0.5 rounded leading-none scale-90 origin-right select-none">
                        估费: {syncForm.feeRate}
                      </span>
                    )}
                  </label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">¥</span>
                    <input
                      id="sync-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={syncForm.fee || ''}
                      onChange={(e) => handleFeeChange(e.target.value)}
                      placeholder="0.00 (选填)"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200/85 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-800 bg-white transition-all shadow-3xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ================= 份额方式主输入 (成交份额 + 手续费) ================= */
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                <div>
                  <label htmlFor="sync-shares" className="block text-[11px] font-bold text-slate-550 mb-1.5 select-none">成交份额 (份)</label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">#</span>
                    <input
                      id="sync-shares"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      required
                      value={syncForm.shares || ''}
                      onChange={(e) => handleSharesChange(e.target.value)}
                      placeholder="0.0000"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200/85 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-800 bg-white transition-all shadow-3xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="sync-fee" className="block text-[11px] font-bold text-slate-550 mb-1.5 select-none">
                    <span>交易手续费 (可选)</span>
                  </label>
                  <div className="relative group">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">¥</span>
                    <input
                      id="sync-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={syncForm.fee || ''}
                      onChange={(e) => handleFeeChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200/85 rounded-xl focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-800 bg-white transition-all shadow-3xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. 交易日期 与 时间 Cutoff Toggle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sync-date" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>交易发生日期</span>
            </label>
            <input
              id="sync-date"
              type="date"
              required
              value={syncForm.tradeDate || ''}
              onChange={(e) => onChange({ ...syncForm, tradeDate: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200/80 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-mono font-bold text-slate-700 bg-white shadow-2xs transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>交易确认时段</span>
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100/80 p-0.5 rounded-2xl border border-slate-200/40 shadow-inner h-[46px] items-center">
              <button
                type="button"
                onClick={() => handleTimeChange('before15')}
                className={`h-[38px] rounded-xl text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer border border-transparent ${
                  confirmTime === 'before15' 
                    ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="font-extrabold">15:00 前</span>
                <span className="text-[8px] opacity-75 leading-none scale-90 mt-0.5">当天价格折算</span>
              </button>
              <button
                type="button"
                onClick={() => handleTimeChange('after15')}
                className={`h-[38px] rounded-xl text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer border border-transparent ${
                  confirmTime === 'after15' 
                    ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="font-extrabold">15:00 后</span>
                <span className="text-[8px] opacity-75 leading-none scale-90 mt-0.5">下工作日折算</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6. 折算明细与份额预览 (Premium Bank Statement / Receipt Preview Card) */}
        {isAmountValid && referenceNetValue > 0 && (
          <div className="p-4.5 rounded-2xl bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 border border-blue-100/70 text-xs font-mono space-y-3.5 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="font-black text-slate-700 flex items-center gap-2 font-sans border-b border-dashed border-blue-200/70 pb-2.5 select-none">
              <Calculator className="w-4.5 h-4.5 text-blue-600 shrink-0" />
              <span>交易折算与份额实时清单</span>
            </div>

            <div className="flex justify-between items-center text-slate-500 leading-none">
              <span>折算参考净值:</span>
              <span className="font-extrabold text-slate-800">¥ {referenceNetValue.toFixed(4)} / 份</span>
            </div>

            <div className="flex justify-between items-center text-slate-500 leading-none">
              <span>确认成交净额:</span>
              <span className="font-extrabold text-slate-800">
                ¥ {netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {feeVal > 0 && selectedType === '买入' && (
                  <span className="text-[10px] text-slate-400 font-medium ml-1.5 select-none">(手续费 -¥{feeVal.toFixed(2)})</span>
                )}
              </span>
            </div>

            {/* Receipt Scalloped/Dashed Separator */}
            <div className="relative h-px my-1 select-none pointer-events-none">
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200/80" />
              <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-50 rounded-full border-r border-blue-100/50" />
              <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-50 rounded-full border-l border-blue-100/50" />
            </div>

            <div className="flex justify-between items-center text-slate-500 pt-0.5 leading-none">
              <span>估算份额变动:</span>
              <span className={`font-black text-sm font-mono ${selectedType === '买入' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {selectedType === '买入' ? '+' : '-'}{sharesDelta.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 份
              </span>
            </div>

            {selectedFund && (
              <div className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between text-[10px] text-slate-500 font-sans leading-none">
                <span className="font-bold select-none">持仓变动预测:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-650">
                    {currentShares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-mono font-black text-slate-800">
                    {nextShares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="font-bold text-slate-500 select-none">份</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部按钮栏 */}
        <div className="flex justify-end gap-3.5 pt-4.5 border-t border-slate-100 mt-7 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 text-xs text-slate-650 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl font-bold transition-all active:scale-[0.98] cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2.5 text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:bg-gradient-none disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-black transition-all shadow-sm hover:shadow active:scale-[0.97] cursor-pointer"
          >
            确认同步
          </button>
        </div>
      </form>
    </Modal>
  );
}
