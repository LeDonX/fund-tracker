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
    desc: "China advisor crash technical action",
    target: '      action = useCashMarket\n        ? "今日收盘已成大面积绿盘回调。对于场外基金，若您在 15:00 前已主动暂停扣款则成功避坑；若未操作，今晚净值将承受较大跌幅。切勿在晚间盲目割肉，静待技术性反弹。"\n        : "今日场外基金建议暂停定投。场内ETF若想减仓，静待9:45左右的反抽高点，切勿在9:30开盘第一分钟割肉。";',
    replacement: '      action = useCashMarket\n        ? "今日收盘已成大面积绿盘回调，大A大打折。交易通道已闭合，今日收盘的特价净值已锁定，定投用户切勿在晚间恐慌割肉，静待企稳技术反弹。"\n        : "大盘处于深度回调暴跌段，场外基金在 15:00 前申购定投可锁定特价净值。场内ETF若想减仓，静待9:45左右的反抽高点，切勿无脑割肉。";'
  },
  {
    desc: "US advisor crash technical action",
    target: '      action = "🔴 推测开盘：21:30 100%低开。操作：今晚美股大概率暴跌，适合15:00前卖出止盈；若要买入则执行【暂停】，等明天以更低净值低吸。";',
    replacement: '      action = "🔴 推测开盘：21:30 100%低开。操作：今晚美股大概率大跌，适合下午 15:00 前卖出止盈锁利；申购定投切勿暂停，15:00 前申购可精准锁定今晚大跌后的特价低净值。";'
  },
  {
    desc: "First Q&A Card",
    target: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：我持有的哪些基金能用到这个提示？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：凡是跟踪国内大A股的【沪深300】、【创业板】或者海外美股的【纳斯达克100】、【标普500】走的基金都适用。包括您持仓里的大A基金和美股海外基金。\n                </span>\n              </div>',
    replacement: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：大盘暴跌时，我需要手动“暂停定投”来避坑吗？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：<span className="font-black text-emerald-500">绝对不需要，甚至恰恰相反！</span> 基金定投（DCA）的核心逻辑在于“低位收集更多廉价份额，均摊持仓成本”。大盘暴跌日正是基金净值大打折的时候。在下午 15:00 前保持自动定投（甚至适当分批加仓），可以用更低廉的折扣价格买到相同的基金份额，从而在后续反弹中更快解套并赚取收益。如果在暴跌日暂停定投，恰恰违背了定投“低买高卖”的底层逻辑。\n                </span>\n              </div>'
  },
  {
    desc: "Second Q&A Card",
    target: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：为什么下午3点前暂停扣款能省钱？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：因为美股跳空大跌会导致明天补跌。今天下午 3:00 前去您的基金账户里【暂停定投】，明天下午就能用便宜 1% 到 2% 的更低净值买入相同的份额，白白省下买入成本！\n                </span>\n              </div>',
    replacement: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：为什么说下午 3:00 是基金交易的“生命线”？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：我国场外公募基金均遵循 T+1 交易规则，每个工作日 <span className="font-black text-slate-755">下午 15:00 是申购与赎回的分水岭</span>：\n                  <br />• <span className="font-black text-slate-650">15:00 前</span>下单：按<span className="text-rose-500">今天（T 日）</span>晚上公布的净值成交，即时锁定今天的市场行情。\n                  <br />• <span className="font-black text-slate-650">15:00 后或周末</span>下单：顺延到<span className="text-blue-500">下一个交易日（T+1）</span>，适用下一个交易日晚上公布的净值结算。盘后暴跌时盲目追买是无法锁定今日暴跌的折价净值的。\n                </span>\n              </div>'
  },
  {
    desc: "Third Q&A Card",
    target: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：这个投资助手是全自动的吗？为什么有手动调节的？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：本助手<span className="font-black text-rose-500">100%全自动运行，已自动接入全球实时行情</span>！页面显示的今日走势和操作意见都是系统自动算好的，您不需要手动调任何东西。手动的滑动条和输入框是“专业量化模式”下供高阶玩家模拟测试用的，小白可以直接忽略它，直接看本页的红绿字建议操作即可，超级简单！\n                </span>\n              </div>',
    replacement: '              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-3xs">\n                <span className="text-slate-700 font-extrabold block">📌 问：海外美股 QDII 基金存在“一天时差”，该怎么看操作意见？</span>\n                <span className="text-slate-450 block mt-1 font-semibold leading-normal">\n                  答：QDII 基金（如纳斯达克100、标普500基金）由于交易所在海外，在工作日 <span className="font-black text-slate-755">下午 15:00 前</span> 申购，锁定的是 <span className="font-black text-rose-500">今晚美股开盘到收盘的净值</span>（于 T+1 工作日晚计算并公布）。所以下午 15:00 前的申购等于“提前预订”今晚美股的特价票，这让本助手提供的“盘前期指气象预测”具备极高交易指导价值！\n                </span>\n              </div>'
  },
  {
    desc: "China Novice Panel Container",
    target: '          {advisorSubTab === \'china\' ? (\n            // China Novice Output\n            <div className={`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 ${chinaAdvisorData.border} bg-gradient-to-br ${chinaAdvisorData.cardGradient}`}>\n              \n              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">\n                <div className="flex items-center gap-2">\n                  <span className="text-lg">🤖</span>\n                  <div className="flex flex-col text-left">\n                    <span className="text-xs font-black text-slate-750 tracking-wider">智能理财管家早盘建议</span>\n                    {lastUpdated && (\n                      <span className="text-[9px] text-slate-400 font-bold mt-0.5">\n                        {chinaSimMode \n                          ? \'⚠️ 依据量化沙盒模拟器数据\' \n                          : `依据时间: ${lastUpdated.toLocaleString(\'zh-CN\', { month: \'numeric\', day: \'numeric\', hour: \'2-digit\', minute: \'2-digit\' })} 实时行情`}\n                      </span>\n                    )}\n                  </div>\n                </div>\n                <span className={`text-10 font-black px-3.5 py-1 rounded-full border ${chinaAdvisorData.bg} ${chinaAdvisorData.color}`}>\n                  今日走势: {chinaStatusLabel}\n                </span>\n              </div>\n\n              <div className="flex flex-col gap-4 text-left">\n                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">\n                  {chinaAdvisorData.activeRule === 1 ? \'🔴 今天建议暂停定投！去暂停今天扣款，明天能用更便宜的价格买入！\' : \n                   chinaAdvisorData.activeRule === 2 ? \'🟢 今天非常适合买入！大资金正在疯狂抢购，大涨在招手！\' : \n                   chinaAdvisorData.activeRule === 3 ? \'🟡 核心大公司护盘但科技股暴跌，市场冷热不均，建议不要盲目买卖！\' :\n                   \'☁️ 今天行情很平稳。不要乱折腾，继续保持平时原有的常规扣款即可！\'}\n                </h2>\n                \n                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">\n                  <div className="flex gap-2.5 items-start">\n                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>\n                    <div className="flex flex-col gap-1 text-12 font-extrabold text-slate-650 leading-relaxed font-sans">\n                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">操作指导意见</h4>\n                      {chinaAdvisorData.activeRule === 1 && (\n                        <p>\n                          今天市场下跌意愿强劲，大盘开盘必然暴跌。<span className="text-rose-500 font-black">请立刻去理财APP或天天基金暂停您今天的扣款申购</span>。今天把定投省下来，明天下午您就能用更低的价格申购，凭空多得 1%~2% 的基金份额！\n                        </p>\n                      )}\n                      {chinaAdvisorData.activeRule === 2 && (\n                        <p>\n                          大资金多头共振超级爆发，主力拉高确立！今天市场大涨概率极高，光头大阳线在招手。<span className="text-emerald-500 font-black">如果您打算做多或加仓建仓，下午 14:30 左右可以果断加仓买入</span>，直接坐享红利！手里持有的千万别卖，让利润跑起来！\n                        </p>\n                      )}\n                      {chinaAdvisorData.activeRule === 3 && (\n                        <p>\n                          二八分化严重。国家队拉大蓝筹、银行板块护盘，但科技创业板权重受美股拖累走弱，板块走势南辕北辙。<span className="text-amber-500 font-black">乱折腾买卖极易吃耳光，最佳操作是持股不动，避免盲目调仓！</span>\n                        </p>\n                      )}\n                      {chinaAdvisorData.activeRule === 4 && (\n                        <p>\n                          今天离岸风向标波动非常微弱，大盘将大概率横向震荡拉锯。<span className="text-blue-500 font-black">不要做任何打破常规的调仓！继续严格遵循您原有的周定投/月定投日常扣款即可</span>，多动多错，不折腾就是变相赚钱。\n                        </p>\n                      )}\n                    </div>\n                  </div>\n                </div>\n              </div>\n\n            </div>`,
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
                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">场外基金 T+1 交易操作指导意见</h4>
                      {marketPhase === 'post' ? (
                        // Post-market China copy
                        <>
                          {chinaAdvisorData.activeRule === 1 && (
                            <p>
                              今天大A遭遇了放量下跌，市场情绪较为悲观。<span className="text-emerald-500 font-black">此时 15:00 基金结算通道已关闭</span>，今天的收盘净值已锁定（今晚净值将有明显回落）。现在提交申购将执行下一个交易日（T+1）的结算净值。请保持绝对冷静，定投用户切勿在暴跌日晚上因为焦虑而盲目割肉赎回，静待恐慌泥沙俱下后的企稳回升。
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
                              市场波动微弱，横盘整理。没有高胜率交易机会，<span className="text-blue-500 font-black">下午 15:00 前维持常规节奏</span>，老老实实遵循既定的定投自动扣款，大仓位按兵不动。
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>`
  },
  {
    desc: "US Novice Panel Container",
    target: '          ) : (\n            // US Novice Output\n            <div className={`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 ${usAdvisorData.border} bg-gradient-to-br ${usAdvisorData.cardGradient}`}>\n              \n              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">\n                <div className="flex items-center gap-2">\n                  <span className="text-lg">🤖</span>\n                  <div className="flex flex-col text-left">\n                    <span className="text-xs font-black text-slate-755 tracking-wider">智能理财管家午后建议</span>\n                    {lastUpdated && (\n                      <span className="text-[9px] text-slate-400 font-bold mt-0.5">\n                        {usSimMode \n                          ? \'⚠️ 依据量化沙盒模拟器数据\' \n                          : `依据时间: ${lastUpdated.toLocaleString(\'zh-CN\', { month: \'numeric\', day: \'numeric\', hour: \'2-digit\', minute: \'2-digit\' })} 实时行情`}\n                      </span>\n                    )}\n                  </div>\n                </div>\n                <span className={`text-10 font-black px-3.5 py-1 rounded-full border ${usAdvisorData.bg} ${usAdvisorData.color}`}>\n                  今日走势: {usStatusLabel}\n                </span>\n              </div>\n\n              <div className="flex flex-col gap-4 text-left">\n                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">\n                  {usAdvisorData.activeRule === 0 ? \'⚠️ 紧急紧急！美股面临灾难级暴跌，赶快赎回跑路！\' :\n                   usAdvisorData.activeRule === 1 ? \'⏳ 重大事件日！下午行情多噪音，按常规计划不调仓！\' :\n                   usAdvisorData.activeRule === 2 ? \'🔴 今天建议暂停定投！去暂停今日扣款，明天能省下买入成本！\' : \n                   usAdvisorData.activeRule === 3 ? \'🟢 今天非常适合加仓！今晚美股极大概率大涨，下午3点前直接上车！\' : \n                   usAdvisorData.activeRule === 4 ? \'☁️ 市场平稳没有大方向，继续执行您的常规日常定投即可！\' :\n                   usAdvisorData.activeRule === 5 ? \'🟡 科技股与核心大企业分裂分化，剧烈震荡洗盘中，先别买卖！\' :\n                   \'☁️ 窄幅波动，老老实实执行常规定投，不动如山。\'}\n                </h2>\n                \n                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">\n                  <div className="flex gap-2.5 items-start">\n                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>\n                    <div className="flex flex-col gap-1 text-12 font-extrabold text-slate-650 leading-relaxed font-sans">\n                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">操作指导意见</h4>\n                      {usAdvisorData.activeRule === 0 && (\n                        <p>\n                          美股盘前触发了特大事故大熔断！开盘将面临惨烈下杀。<span className="text-red-500 font-black">请赶在下午 15:00 结束交易前申请卖出赎回避险，绝对绝对不能买入！</span>\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 1 && (\n                        <p>\n                          美国今晚有特大重磅宏观数据公布，下午的行情全是假动作烟雾弹，毫无胜率优势。<span className="text-slate-650 font-black">不要进行任何临时加仓或卖出，老老实实维持原有仓位以静制动！</span>\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 2 && (\n                        <p>\n                          欧美资金正在崩盘式出逃，今晚大跌已成定局！<span className="text-rose-500 font-black">请在下午 15:00 前去您的基金理财APP中把今天的定投扣款临时【暂停】</span>。明天下午您将以便宜 1% 到 2% 的超低成本价格买到同样的份额！如果有赎回止盈计划的，赶紧在 15:00 前卖出锁定收益！\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 3 && (\n                        <p>\n                          主力大资金多头疯抢，空头被打爆的单边大逼空行情确立！今晚美股100%跳空大涨。<span className="text-emerald-500 font-black">如果您原本就有做多计划，在下午 15:00 前赶紧砸钱加仓买入</span>，直接坐享昨晚的高额跳空红利！手里持有的筹码绝对别动！\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 4 && (\n                        <p>\n                          市场毫无方向，盘整垃圾时间。<span className="text-blue-500 font-black">严格禁止打破常规的调仓动作！继续保持日常周/月定投日常扣款即可</span>，多动多错，省下交易手续费。\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 5 && (\n                        <p>\n                          科技股被大盘撕裂割裂分化，震荡极强，洗盘行情明显。<span className="text-amber-500 font-black">信号失真，不买不卖以静制动，严格遵守日常纪律即可！</span>\n                        </p>\n                      )}\n                      {usAdvisorData.activeRule === 6 && (\n                        <p>\n                          指数在窄幅区间波动，没有强单边多空信号。<span className="text-slate-600 font-black">老老实实执行您原有的定投计划，大仓位按兵不动，不用做任何额外动作。</span>\n                        </p>\n                      )}\n                    </div>\n                  </div>\n                </div>\n              </div>\n\n            </div>\n          )',
    replacement: `          ) : (
            // US Novice Output
            <div className={\`border rounded-3xl p-6.5 flex flex-col gap-5 shadow-xs transition-all duration-300 \subAdvisorData === 'china' ? (\` === 'us' ? (\` \${usAdvisorData.border} bg-gradient-to-br \${usAdvisorData.cardGradient}\`}>
              
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black text-slate-755 tracking-wider">
                      {marketPhase === 'post' ? '智能理财管家盘后前瞻' : '智能理财管家交易指导'}
                    </span>
                    {lastUpdated && (
                      <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                        {usSimMode 
                          ? '⚠️ 依据量化沙盒模拟器数据' 
                          : \`依据时间: \${lastUpdated.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 实时行情\`}
                      </span>
                    )}
                  </div>
                </div>
                <span className={\`text-10 font-black px-3.5 py-1 rounded-full border \${usAdvisorData.bg} \${usAdvisorData.color}\`}>
                  今日走势: {usStatusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-850 tracking-tight leading-snug">
                  {marketPhase === 'post' ? (
                    // Post-market US Title
                    usAdvisorData.activeRule === 0 ? '⚠️ 美股极端熔断！今日交易通道已闭合，持仓用户请勿在下周盲目割肉！' :
                    usAdvisorData.activeRule === 1 ? '⏳ 重大事件落地。今日交易通道已闭合，按常规计划不折腾。' :
                    usAdvisorData.activeRule === 2 ? '🌧️ 美股今晚面临明显下杀。今日申购已截止，盘后请冷静观望。' : 
                    usAdvisorData.activeRule === 3 ? '☀️ 美股今晚必迎跳空暴涨！今日 15:00 通道已闭合，底仓躺赚。' : 
                    '☁️ 海外大盘震荡整理。今日交易已截止，继续老老实实执行常规定投即可。'
                  ) : (
                    // Trading/Pre-market US Title
                    usAdvisorData.activeRule === 0 ? '🟢 捡钱机会！美股期指触发盘前暴跌，15:00前申购锁定今晚暴跌特价净值！' :
                    usAdvisorData.activeRule === 1 ? '⏳ 重磅数据日！盘前期指多噪音，下午 15:00 前保持按兵不动！' :
                    usAdvisorData.activeRule === 2 ? '🟢 绝佳收集份额机会！美股盘前承压，15:00前定投/申购即可享受“折价”净值！' : 
                    usAdvisorData.activeRule === 3 ? '🟡 美股多头暴拉！今晚跳空暴涨确定，下午 15:00 前【切勿跟风追高】。' : 
                    '☁️ 盘前多空拉锯温和。下午 15:00 前执行常规日常定投，无需打破常规。'
                  )}
                </h2>
                
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-2.5xl border border-slate-200 shadow-sm leading-relaxed flex flex-col gap-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-2xl select-none shrink-0 filter drop-shadow-sm">💡</span>
                    <div className="flex flex-col gap-1 text-12 font-extrabold text-slate-650 leading-relaxed font-sans">
                      <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest leading-none mb-1 select-none">海外 QDII 基金 T+1 交易操作指导意见</h4>
                      {marketPhase === 'post' ? (
                        // Post-market QDII advice
                        <>
                          {usAdvisorData.activeRule === 0 && (
                            <p>
                              美股盘前期货触发了灾难级大熔断，开盘面临深度暴跌下杀。<span className="text-red-500 font-black">由于 15:00 通道已闭合</span>，你已无法干预今晚的 QDII 净值结算（今晚持仓会遭受较重打击）。请保持绝对理性和定力，千万不要在下一个交易日看到理财软件补跌时盲目割肉赎回，静待超跌反弹。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 1 && (
                            <p>
                              美国今晚将发布重大宏观经济数据，下午盘前的波动全是噪音迷雾。<span className="text-slate-650 font-black">今日申购已截止</span>，安心等待今晚美股收盘尘埃落定，维持原有底仓，下个交易日再做研判。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 2 && (
                            <p>
                              美股盘前显著下跌，今晚大概率深度回调。<span className="text-emerald-500 font-black">今日交易通道已闭合</span>，现在提交的任何申购都将执行下一个交易日（T+1）的结算净值。因为美股处于下跌段，建议今晚保持冷静，无需急于在盘后补仓，待下一个交易日盘前观察是否止跌企稳。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 3 && (
                            <p>
                              美股多头极其强盛，今晚将大涨收红！<span className="text-rose-500 font-black">由于今日 15:00 申购已截止</span>，切勿在盘后或明天早晨看到美股大涨后盲目在软件内追高申购（现在买将买在 T+1 高位净值）。静静享受你手里已有底仓今晚的利润奔跑！
                            </p>
                          )}
                          {usAdvisorData.activeRule >= 4 && (
                            <p>
                              海外指数处于窄幅区间震荡整理，今日 QDII 基金交易通道已闭合。<span className="text-blue-500 font-black">无需进行任何手动额外干预</span>，老老实实让你的周/月定投在下一个扣款日按部就班自动运行。
                            </p>
                          )}
                        </>
                      ) : (
                        // Pre-market and trading QDII advice
                        <>
                          {usAdvisorData.activeRule === 0 && (
                            <p>
                              美股期货盘前遭遇特大事件导致暴跌熔断！今晚美股注定开盘暴泻。请高度注意：场外美股 QDII 基金在下午 15:00 前申购可以精准锁定【今晚美股暴跌收盘的超便宜底位净值】！**定投千万不要暂停，这绝对是千载难逢的白捡便宜货的机会**！大胆坚持定投扣款收集低价份额。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 1 && (
                            <p>
                              美国今晚发布重磅数据，下午盘前的期货波动大概率属于主力诱多或诱空的噪音信号。<span className="text-slate-650 font-black">下午 15:00 前保持以静制动</span>，雷打不动维持既定节奏，不要盲目加仓或赎回。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 2 && (
                            <p>
                              今晚美股大盘大概率回调大跌。由于场外美股 QDII 基金在工作日下午 15:00 前下单能享受【今晚美股收盘时的特价净值】，**因此如果你正想对标普/纳指加仓，下午 15:00 前的申购是极好的低吸折扣份额机会**！定投绝对不能暂停，坚持定投才能不断摊平你的持仓成本！有赎回止盈计划的可在 15:00 前赎回锁定大跌前的昨日高位净值。
                            </p>
                          )}
                          {usAdvisorData.activeRule === 3 && (
                            <p>
                              多头情绪高涨，美股今晚必将跳空大涨。由于下午 15:00 前申购会买在今晚的【高红盘净值】（即追高申购，极易买在短期波段顶部），<span className="text-rose-500 font-black">建议下午 15:00 前保持冷静观望</span>，防范追高。如果有原定的赎回止盈计划，下午 15:00 前卖出可锁定今晚暴涨的高点净值。
                            </p>
                          )}
                          {usAdvisorData.activeRule >= 4 && (
                            <p>
                              海外风向标走势极其平稳，无明确强多/强空交易信号。<span className="text-blue-500 font-black">下午 15:00 前无特殊操作机会</span>。老老实实执行您原有的定投计划自动扣款，大仓位保持按兵不动。
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )`
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
