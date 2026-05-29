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

const replacements = [
  {
    desc: "China Novice Panel Container",
    target: `          {advisorSubTab === 'china' ? (
            // China Novice Output
            <div className={\`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 \${chinaAdvisorData.border} bg-gradient-to-br \${chinaAdvisorData.cardGradient}\`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black text-slate-750 tracking-wider">智能理财管家早盘建议</span>
                    {lastUpdated && (
                      <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                        {chinaSimMode 
                          ? '⚠️ 依据量化沙盒模拟器数据' 
                          : \`依据时间: \${lastUpdated.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 实时行情\`}
                      </span>
                    )}
                  </div>
                </div>
                <span className={\`text-10 font-black px-3.5 py-1 rounded-full border \${chinaAdvisorData.bg} \${chinaAdvisorData.color}\`}>
                  今日走势: {chinaStatusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">
                  {chinaAdvisorData.activeRule === 1 ? '🔴 今天建议暂停定投！去暂停今天扣款，明天能用更便宜的价格买入！' : 
                   chinaAdvisorData.activeRule === 2 ? '🟢 今天非常适合买入！大资金正在疯狂抢购，大涨在招手！' : 
                   chinaAdvisorData.activeRule === 3 ? '🟡 核心大公司护盘但科技股暴跌，市场冷热不均，建议不要盲目买卖！' :
                   '☁️ 今天行情很平稳。不要乱折腾，继续保持平时原有的常规扣款即可！'}
                </h2>
                
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>
                    <div className="flex flex-col gap-1 text-12 font-extrabold text-slate-650 leading-relaxed font-sans">
                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">操作指导意见</h4>
                      {chinaAdvisorData.activeRule === 1 && (
                        <p>
                          今天市场下跌意愿强劲，大盘开盘必然暴跌。<span className="text-rose-500 font-black">请立刻去理财APP或天天基金暂停您今天的扣款申购</span>。今天把定投省下来，明天下午您就能用更低的价格申购，凭空多得 1%~2% 的基金份额！
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 2 && (
                        <p>
                          大资金多头共振超级爆发，主力拉高确立！今天市场大涨概率极高，光头大阳线在招手。<span className="text-emerald-500 font-black">如果您打算做做多或加仓建仓，下午 14:30 左右可以果断加仓买入</span>，直接坐享红利！手里持有的千万别卖，让利润跑起来！
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 3 && (
                        <p>
                          二八分化严重。国家队拉大蓝筹、银行板块护盘，但科技创业板权重受美股拖累走弱，板块走势南辕北辙。<span className="text-amber-500 font-black">乱折腾买卖极易吃耳光，最佳操作是持股不动，避免盲目调仓！</span>
                        </p>
                      )}
                      {chinaAdvisorData.activeRule === 4 && (
                        <p>
                          今天离岸风向标波动非常微弱，大盘将大概率横向震荡拉锯。<span className="text-blue-500 font-black">不要做任何打破常规的调仓！继续严格遵循您原有的周定投/月定投日常扣款即可</span>，多动多错，不折腾就是变相赚钱。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>`.replace('打算做做多', '打算做多'),
    replacement: `          {advisorSubTab === 'china' ? (
            // China Novice Output
            <div className={\`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 \${chinaAdvisorData.border} bg-gradient-to-br \${chinaAdvisorData.cardGradient}\`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black text-slate-755 tracking-wider">
                      {marketPhase === 'post' ? '智能理财管家收盘前瞻' : '智能理财管家交易指导'}
                    </span>
                    {lastUpdated && (
                      <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                        {chinaSimMode 
                          ? '⚠️ 依据量化沙盒模拟器数据' 
                          : \`依据时间: \${lastUpdated.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 实时行情\`}
                      </span>
                    )}
                  </div>
                </div>
                <span className={\`text-10 font-black px-3.5 py-1 rounded-full border \${chinaAdvisorData.bg} \${chinaAdvisorData.color}\`}>
                  今日走势: {chinaStatusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">
                  {marketPhase === 'post' ? (
                    // Post-market China Title
                    chinaAdvisorData.activeRule === 1 ? '🌧️ 大A今日遭遇暴跌。今日交易已截止，底仓请静待底部企稳。' :
                    chinaAdvisorData.activeRule === 2 ? '☀️ 大A今日红盘大涨！今日交易已截止，底仓躺赚，请勿在盘后追高。' :
                    chinaAdvisorData.activeRule === 3 ? '⛅ 大A今日二八分化严重。交易已截止，老实持仓不动以静制动。' :
                    '☁️ 大A今日窄幅横盘。今日交易已截止，老老实实执行常规定投计划即可。'
                  ) : (
                    // Trading/Pre-market China Title
                    chinaAdvisorData.activeRule === 1 ? '🟢 暴跌即是特价！下午 15:00 前是【分批低吸 / 坚持定投】的绝佳良机！' :
                    chinaAdvisorData.activeRule === 2 ? '🟡 多头强力飙升！今日净值较高，下午 15:00 前【切勿盲目追高申购】。' :
                    chinaAdvisorData.activeRule === 3 ? '⛅ 传统权重护盘但科技股大跌。板块分化严重，下午 15:00 前【建议静观其变】。' :
                    '☁️ 今日行情波澜不惊。下午 15:00 前执行既定扣款计划，无需盲目调仓。'
                  )}
                </h2>
                
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>
                    <div className="flex flex-col gap-1 text-12 font-extrabold text-slate-650 leading-relaxed font-sans">
                      <h4 className="text-xs font-black text-slate-455 uppercase tracking-widest leading-none mb-1 select-none">场外基金 T+1 交易操作指导意见</h4>
                      {marketPhase === 'post' ? (
                        // Post-market China copy
                        <>
                          {chinaAdvisorData.activeRule === 1 && (
                            <p>
                              今天大A遭遇了放量下跌，市场情绪较为悲观。<span className="text-emerald-500 font-black">此时 15:00 基金结算通道已关闭</span>，今天的收盘净值已锁定（今晚净值将有明显回落）。现在提交申购将执行下一个交易日（T+1）的结算净值。请保持绝对冷静，定投用户切勿在暴跌日晚上因为焦虑而盲目割肉赎回，静静享受价格大跌后便宜的定投收集机会。
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 2 && (
                            <p>
                              大A多头大获全胜，收盘大阳线锁定，今晚你的基金持仓将迎来大涨盈余！<span className="text-rose-500 font-black">今日申购已截止</span>，切勿在看到大涨后在今晚盘后盲目追加买入（因为现在买会执行下一个交易日高位甚至冲高回落的净值）。坚定享受你已有底仓拉升带来的财富增值即可！
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 3 && (
                            <p>
                              存量博弈，二八分化严重。国家队拉大蓝筹护盘使得上证指数跌幅受限，但科技股普遍遭遇失血大跌。<span className="text-amber-500 font-black">今日交易通道已闭合</span>，没有打破日常纪律的必要，保持定力，无需做任何调仓。
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 4 && (
                            <p>
                              大盘窄幅震荡拉锯，多空力量均衡。<span className="text-blue-500 font-black">今日交易已截止</span>。请继续严格遵循你原有的周定投/月定投扣款节奏，不折腾，让系统自动为您执行常规扣款即可。
                            </p>
                          )}
                        </>
                      ) : (
                        // Pre-market/Trading China copy
                        <>
                          {chinaAdvisorData.activeRule === 1 && (
                            <p>
                              今天市场大面积回调跌幅较深，大A现货处于大打折状态。根据 T+1 规则，下午 15:00 前申购可全额锁定今晚暴跌结算后的【超值低净值】！**定投绝对不要暂停！** 恰恰相反，定投本意就是“低位摊薄成本”，暴跌日正是收集便宜基金份额的黄金时刻，您甚至可考虑手动适当分批低吸加仓，千万不可因恐慌暂停定投！
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 2 && (
                            <p>
                              多头共振超级爆发，主力拉升大阳线，今日基金净值将处于高点。由于下午 15:00 前申购会直接买在今晚的【高点红盘净值】（极易短线买在山顶），<span className="text-rose-500 font-black">建议下午 15:00 前冷静观望</span>，切勿追高申购。让手里持有的底仓浮盈狂飙即可。若原计划有赎回止盈打算，15:00 前下单可锁定今日的高额涨幅。
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 3 && (
                            <p>
                              二八分化，权重护盘但科技股失血大跌，个股/行业基金各走各路。盘中走势复杂且具有欺骗性，<span className="text-amber-500 font-black">下午 15:00 前建议保持不动</span>。乱折腾极易导致两面挨耳光，继续维持原有的日常底仓，多看少动。
                            </p>
                          )}
                          {chinaAdvisorData.activeRule === 4 && (
                            <p>
                              市场波动微弱，横盘整理。没有高胜率交易机会，<span className="text-blue-500 font-black">下午 15:00 前维持常规节奏</span>，老老实实遵循既定的定投自动扣款，大仓位保持按兵不动。
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>`
  }
];

let appliedCount = 0;
for (const rep of replacements) {
  if (content.includes(rep.target)) {
    content = content.replace(rep.target, rep.replacement);
    console.log(`[SUCCESS] Applied replacement for: "${rep.desc}"`);
    appliedCount++;
  } else {
    console.warn(`[WARNING] Target string not found for: "${rep.desc}"`);
  }
}

if (appliedCount > 0) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully wrote ${appliedCount} updates to ${filePath}`);
} else {
  console.log("No updates were applied.");
}
