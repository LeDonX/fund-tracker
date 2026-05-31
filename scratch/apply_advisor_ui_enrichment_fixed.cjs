const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'market', 'GlobalMarketPanel.jsx');

if (!fs.existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF to avoid Windows CRLF mismatches
content = content.replace(/\r\n/g, '\n');

// Part 1: usAdvisorData memo definitions insertion target
const usAdvisorDataMemoTarget = "    return { f_nasdaq, f_sp500, has_macro_data, spread, activeRule, signal, action, label, color, bg, border, indicator, cardGradient };\n  }, [usNasdaqInput, usSp505Input, usMacroData]);";

const usAdvisorDataMemoReplacement = "    return { f_nasdaq, f_sp500, has_macro_data, spread, activeRule, signal, action, label, color, bg, border, indicator, cardGradient };\n  }, [usNasdaqInput, usSp505Input, usMacroData]);\n\n" + 
`  const fundTradingCycle = useMemo(() => {
    const now = new Date();
    
    // Calculate in Asia/Shanghai timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    let hour = 0, minute = 0, weekday = '', year = 0, month = 0, day = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
      if (part.type === 'weekday') weekday = part.value;
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'day') day = parseInt(part.value, 10);
    }
    
    const timeVal = hour * 100 + minute;
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const isAfter3 = timeVal >= 1500;
    
    function getNextBusinessDays(startDateStr, n) {
      let date = new Date(startDateStr);
      let count = 0;
      while (count < n) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sat/Sun
          count++;
        }
      }
      return date;
    }
    
    function format(date) {
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      return m + '月' + d + '日 (' + w + ')';
    }
    
    let tradeDateObj;
    let cutoffMsg = "";
    let isTPlus1Effect = false;
    
    const todayStr = year + '/' + month + '/' + day;
    const todayDateObj = new Date(todayStr);
    
    if (isWeekend) {
      isTPlus1Effect = true;
      cutoffMsg = "当前为周末，非交易时段";
      tradeDateObj = getNextBusinessDays(todayStr, 1);
    } else if (isAfter3) {
      isTPlus1Effect = true;
      cutoffMsg = "已越过 15:00，进入 T+1 交易周期";
      tradeDateObj = getNextBusinessDays(todayStr, 1);
    } else {
      isTPlus1Effect = false;
      cutoffMsg = "15:00 前申赎，锁定今日结算净值";
      tradeDateObj = todayDateObj;
    }
    
    const confirmationDateObj = getNextBusinessDays(tradeDateObj, 1);
    const navDisplayDateObj = getNextBusinessDays(tradeDateObj, 1);
    
    return {
      isTPlus1Effect,
      cutoffMsg,
      hour,
      minute,
      tradeDateStr: format(tradeDateObj),
      confirmationDateStr: format(confirmationDateObj),
      navDisplayDateStr: format(navDisplayDateObj),
      countdownStr: isWeekend 
        ? "等待周一开盘" 
        : (isAfter3 ? "等待下个交易日" : "距离今日 15:00 截止还剩 " + (14 - hour) + "小时" + (60 - minute) + "分钟")
    };
  }, []);

  const dcaBargainData = useMemo(() => {
    const isChina = advisorSubTab === 'china';
    const rate = isChina 
      ? chinaAdvisorData.growth_sentiment 
      : (usNasdaqInput * 0.6 + usSp505Input * 0.4);
      
    let score = 50 - rate * 15;
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    let statusLabel = "";
    let colorClass = "";
    let progressBg = "";
    let desc = "";
    
    if (score >= 75) {
      statusLabel = "🔥 折价超值大捡漏";
      colorClass = "text-emerald-600 bg-emerald-50/70 border-emerald-200";
      progressBg = "bg-emerald-500";
      desc = isChina
        ? "成长科技股深度回调。今日下午 15:00 前进行定投，相当于以特惠折价吸筹，摊薄均价效率极高，良机难得！"
        : "纳指期指及美股盘前承压。下午 15:00 前申购可锁定今晚美股开盘的暴跌底位净值，是大幅摊薄持仓均价的黄金加仓点！";
    } else if (score >= 55) {
      statusLabel = "🟢 折价温和吸筹";
      colorClass = "text-teal-600 bg-teal-50/70 border-teal-200";
      progressBg = "bg-teal-500";
      desc = "大盘温和回落。适合按部就班继续日常自动定投，积攒廉价份额，稳步探低长线持仓成本。";
    } else if (score >= 40) {
      statusLabel = "☁️ 正常平稳吸筹";
      colorClass = "text-slate-500 bg-slate-50 border-slate-200";
      progressBg = "bg-slate-400";
      desc = "市场温和震荡。无需任何额外手动加减仓操作，以静制动，严格遵守日常既定定投节奏即可。";
    } else {
      statusLabel = "⚠️ 溢价风险防冲高";
      colorClass = "text-rose-600 bg-rose-50/70 border-rose-200";
      progressBg = "bg-rose-550 animate-pulse";
      desc = "大盘多头疯抢，估值短期内有些溢价。定投用户应维持常规定投，切勿在当前情绪亢奋点盲目单笔大额追高。";
    }
    
    return { score, statusLabel, colorClass, progressBg, desc };
  }, [advisorSubTab, chinaAdvisorData, usNasdaqInput, usSp505Input]);`;

// Part 2: renderNoviceView left widgets insertion target
const noviceViewLeftTarget = "        </div>\n\n        {/* Right Area: Extremely simple large action cards (7/12 cols) */}";

const noviceViewLeftReplacement = `          {/* Card 1: T+1 Fund Trading Cycle timeline info */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-2xs flex flex-col gap-4 relative overflow-hidden text-left animate-in fade-in duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/15 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <span className="text-xs font-black text-slate-700 tracking-wider">场外基金 T+1 交易时效看板</span>
              </div>
              <span className={"text-[9px] font-black px-2 py-0.5 rounded-full border " + (fundTradingCycle.isTPlus1Effect ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200')}>
                {fundTradingCycle.isTPlus1Effect ? 'T+1 计价期' : 'T日进行中'}
              </span>
            </div>

            {/* Countdown / cut-off status badge */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/40 text-10 font-bold text-slate-500 leading-normal flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>{fundTradingCycle.cutoffMsg}</span>
              </div>
              <span className="font-mono text-[9px] bg-slate-200/50 px-2 py-0.5 rounded text-slate-650">{fundTradingCycle.countdownStr}</span>
            </div>

            {/* Timeline steps */}
            <div className="flex flex-col gap-3 relative pl-3.5 before:content-[''] before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-slate-100">
              
              {/* Step 1: Submit Trade */}
              <div className="flex flex-col gap-0.5 text-left relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white shadow-3xs flex items-center justify-center"></span>
                <span className="text-xs font-black text-slate-700 leading-none">申购/定投申请扣款 (今日 15:00 截止前)</span>
                <span className="text-[10px] text-slate-450 font-bold leading-normal mt-0.5">确认归属交易日：<span className="text-blue-600 font-extrabold">{fundTradingCycle.tradeDateStr} (T日)</span></span>
              </div>

              {/* Step 2: Confirmation */}
              <div className="flex flex-col gap-0.5 text-left relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-white shadow-3xs flex items-center justify-center"></span>
                <span className="text-xs font-black text-slate-655 leading-none">基金份额确认及可查收益</span>
                <span className="text-[10px] text-slate-450 font-bold leading-normal mt-0.5">份额确认交割日：<span className="text-slate-750 font-extrabold">{fundTradingCycle.confirmationDateStr} (T+1)</span></span>
              </div>

              {/* Step 3: Settle NAV display */}
              <div className="flex flex-col gap-0.5 text-left relative">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 border border-white shadow-3xs flex items-center justify-center"></span>
                <span className="text-xs font-black text-slate-655 leading-none">首次净值账面更新与持仓收益查询</span>
                <span className="text-[10px] text-slate-450 font-bold leading-normal mt-0.5">界面持仓更新时间：<span className="text-slate-750 font-extrabold">{fundTradingCycle.navDisplayDateStr} 晚</span></span>
              </div>

            </div>
          </div>

          {/* Card 2: DCA Bargain Hunter Radar */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-2xs flex flex-col gap-3 relative overflow-hidden text-left animate-in fade-in duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/15 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <span className="text-xs font-black text-slate-700 tracking-wider">智能定投 (DCA) 折价捡漏雷达</span>
              </div>
              <span className={"text-[10px] font-black px-2.5 py-0.5 rounded-full border " + dcaBargainData.colorClass}>
                {dcaBargainData.statusLabel}
              </span>
            </div>

            {/* Bargain Index dial/bar */}
            <div className="flex items-center justify-between gap-4 mt-1 bg-slate-50/60 p-3 rounded-2xl border border-slate-200/30">
              <div className="flex flex-col text-left shrink-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">定投定额建仓效率指数</span>
                <span className="text-2xl font-black font-mono text-slate-800 tracking-tight mt-0.5">{dcaBargainData.score} <span className="text-xs text-slate-400 font-bold">/ 100</span></span>
              </div>
              <div className="flex-1 flex flex-col gap-1.5 justify-center">
                <div className="h-2.5 bg-slate-150 rounded-full overflow-hidden relative border border-slate-200/40">
                  <div 
                    className={"h-full rounded-full transition-all duration-500 " + dcaBargainData.progressBg} 
                    style={{ width: dcaBargainData.score + "%" }} 
                  />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-slate-400 font-mono">
                  <span>高溢价 (0)</span>
                  <span>中性 (50)</span>
                  <span>高折价 (100)</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-bold font-sans">
              {dcaBargainData.desc}
            </p>
          </div>

        </div>

        {/* Right Area: Extremely simple large action cards (7/12 cols) */}`;

if (content.includes(usAdvisorDataMemoTarget)) {
  content = content.replace(usAdvisorDataMemoTarget, usAdvisorDataMemoReplacement);
  console.log("[SUCCESS] Patched usAdvisorData memo definitions.");
} else {
  console.error("[ERROR] Failed to patch usAdvisorData memo definitions.");
  process.exit(1);
}

if (content.includes(noviceViewLeftTarget)) {
  content = content.replace(noviceViewLeftTarget, noviceViewLeftReplacement);
  console.log("[SUCCESS] Patched renderNoviceView left widgets.");
} else {
  console.error("[ERROR] Failed to patch renderNoviceView left widgets.");
  process.exit(1);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully wrote advisor UI enrichment updates!");
