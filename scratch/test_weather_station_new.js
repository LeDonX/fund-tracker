import { onRequestGet } from '../functions/api/market.js';

// Replicate frontend useMemo calculations exactly
function computeWeatherAndSignals(indices) {
  // 1. Replicate marketPhase detection
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  });
  const parts = formatter.formatToParts(now);
  let hour = 0;
  let minute = 0;
  let weekday = '';
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'weekday') weekday = part.value;
  }
  const timeVal = hour * 100 + minute;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  let marketPhase = 'post';
  if (isWeekend) marketPhase = 'post';
  else if (timeVal < 930) marketPhase = 'pre';
  else if (timeVal <= 1500) marketPhase = 'trading';
  else marketPhase = 'post';

  console.log('--- Time Settings ---');
  console.log(`Current Time (Asia/Shanghai): ${weekday} ${hour}:${minute}`);
  console.log(`Market Phase: ${marketPhase}`);

  // Replicate chinaAdvisorData
  const shIndex = indices.find(idx => idx.symbol === '000001.SS');
  const cyIndex = indices.find(idx => idx.symbol === '399006.SZ');
  const shChg = shIndex ? shIndex.changePercent : 0.0;
  const cyChg = cyIndex ? cyIndex.changePercent : 0.0;

  const f_a50_morning = indices.find(idx => idx.symbol === 'CN=F')?.changePercent ?? 0.0;
  const hxc_last_night = indices.find(idx => idx.symbol === '^HXC')?.changePercent ?? 0.0;

  const useCashMarket = marketPhase === 'trading' || marketPhase === 'post';

  const traditionalChg = useCashMarket ? shChg : f_a50_morning;
  const growthChg = useCashMarket ? cyChg : hxc_last_night;

  const growth_sentiment = 0.4 * traditionalChg + 0.6 * growthChg;
  
  let activeRule = -1;
  let signal = "";
  let action = "";
  let label = "";

  const isCrash = useCashMarket
    ? (traditionalChg <= -0.6 && growthChg <= -1.2)
    : (traditionalChg <= -0.8 && growthChg <= -1.5);

  const isRise = useCashMarket
    ? (traditionalChg >= 0.6 && growthChg >= 1.2)
    : (traditionalChg >= 0.8 && growthChg >= 1.5);

  const isDivergence = useCashMarket
    ? (traditionalChg >= 0.4 && growthChg <= -0.8)
    : (traditionalChg >= 0.5 && growthChg <= -1.0);

  if (isCrash) {
    activeRule = 1;
    signal = useCashMarket
      ? "🔴 [严重警报] 大A与创业板今日遭遇放量暴跌！"
      : "🔴 [严重警报] 大A与创业板今早将大幅低开！";
    action = useCashMarket
      ? "今日收盘已成大面积绿盘回调。对于场外基金，若您在 15:00 前已主动暂停扣款则成功避坑；若未操作，今晚净值将承受较大跌幅。切勿在晚间盲目割肉，静待技术性反弹。"
      : "今日场外基金建议暂停定投。场内ETF若想减仓，静待9:45左右的反抽高点，切勿在9:30开盘第一分钟割肉。";
    label = "共振暴跌";
  } else if (isRise) {
    activeRule = 2;
    signal = useCashMarket
      ? "🟢 [多头逼空] 大A与创业板今日大获全胜，红盘高歌！"
      : "🟢 [多头逼空] 大A与创业板今早将大幅高开！";
    action = useCashMarket
      ? "情绪极其亢奋，收盘大阳线确定。持有底仓的投资者应坚定持有，让利润奔跑；切勿在收盘后盲目追高，等待合理回调再加仓。"
      : "情绪极其亢奋。场内ETF切勿开盘无脑追高（谨防高开低走）；场外基金如需建仓，可在下午14:30观察是否抱团封死阳线再做决定。";
    label = "多头逼空";
  } else if (isDivergence) {
    activeRule = 3;
    signal = useCashMarket
      ? "🟡 [二八分化] 传统蓝筹护盘，创业板科技股失血暴跌！"
      : "🟡 [二八分化] 传统蓝筹护盘，创业板承压！";
    action = useCashMarket
      ? "国家队拉动中字头、银行等传统权重护盘（上证指数跌幅受限），但新能源、半导体等创业板权重失血暴跌。板块各走各路，此时千万不宜盲目乱动调仓，多看少动。"
      : "今天国家队可能会拉中字头、银行（A50强），但新能源、半导体等创业板权重（受中概拖累）会走弱。个股/行业基金各走各路，不宜盲目乱动。";
    label = "二八分化";
  } else {
    activeRule = 4;
    signal = useCashMarket
      ? "☁️ [横盘震荡] 大盘在平稳区间内窄幅拉锯"
      : "⚪ [震荡市] 离岸市场波动微弱";
    action = useCashMarket
      ? "今日大盘波澜不惊，多空处于温和拉锯状态。无明显的单边操作机会，继续保持原有的日常定投节奏，多看少动为主。"
      : "大A今天大概率维持震荡横盘，按照既定定投计划执行即可，无超额盘中交易机会。";
    label = "震荡整理";
  }

  // Jargon-free market weather indicators for Novice Mode
  const a50Val = useCashMarket ? shChg : f_a50_morning;
  const a50Label = useCashMarket ? "A股主板大盘 (代表传统蓝筹白马)" : "A股核心大公司前瞻 (如茅台、银行等)";
  const a50Sub = useCashMarket ? "(上证综合指数)" : "(富时中国 A50 指数)";
  
  let a50Weather = "⛅ 多云 (平稳没有大涨大跌)";
  let a50Emoji = "⛅";
  
  const a50Thresh = useCashMarket ? 0.6 : 0.8;
  if (a50Val >= a50Thresh) {
    a50Weather = useCashMarket ? "☀️ 晴天 (大盘权重股显著走强)" : "☀️ 晴天 (大上市公司强劲拉升)";
    a50Emoji = "☀️";
  } else if (a50Val <= -a50Thresh) {
    a50Weather = useCashMarket ? "🌧️ 雨天 (大盘权重股遭遇明显回调)" : "🌧️ 雨天 (核心股票明显下跌)";
    a50Emoji = "🌧️";
  }

  const hxcVal = useCashMarket ? cyChg : hxc_last_night;
  const hxcLabel = useCashMarket ? "A股创业科技 (代表成长、芯片新能源)" : "中国科技股前瞻 (如阿里、拼多多等)";
  const hxcSub = useCashMarket ? "(创业板指数)" : "(中概金龙指数 HXC)";

  let hxcWeather = "⛅ 多云 (科技股平稳整理)";
  let hxcEmoji = "⛅";
  
  const hxcThresh = useCashMarket ? 1.2 : 1.5;
  if (hxcVal >= hxcThresh) {
    hxcWeather = useCashMarket ? "☀️ 晴天 (创业板指全线强劲大涨)" : "☀️ 晴天 (中概科技股超级大涨)";
    hxcEmoji = "☀️";
  } else if (hxcVal <= -hxcThresh) {
    hxcWeather = useCashMarket ? "🌧️ 暴雨 (创业成长股遭遇深度调整)" : "🌧️ 雨天 (中概科技股陷入大跌)";
    hxcEmoji = "🌧️";
  }

  const chinaStatusLabel = {
    '共振暴跌': '🌧️ 全线大跌 (雷雨天气)',
    '多头逼空': '☀️ 全线大涨 (晴空万里)',
    '二八分化': '⛅ 蓝筹涨、科技跌 (冷热不均)',
    '震荡整理': '☁️ 窄幅震荡 (微风轻拂)'
  }[label] || label;

  console.log('\n--- Live A-Shares Cash Market Values ---');
  console.log(`Shanghai Composite (000001.SS) Change: ${shChg}%`);
  console.log(`ChiNext Index (399006.SZ) Change: ${cyChg}%`);

  console.log('\n--- Updated Advisor Outputs ---');
  console.log(`Active Rule: ${activeRule}`);
  console.log(`Label: ${label}`);
  console.log(`Signal: ${signal}`);
  console.log(`Action: ${action}`);
  console.log(`Card 1 (${a50Label} ${a50Sub}): ${a50Emoji} ${a50Weather}`);
  console.log(`Card 2 (${hxcLabel} ${hxcSub}): ${hxcEmoji} ${hxcWeather}`);
  console.log(`China Status Label (Novice View): ${chinaStatusLabel}`);
}

async function run() {
  const mockContext = {
    request: {
      url: 'http://localhost/api/market'
    }
  };
  const response = await onRequestGet(mockContext);
  const json = await response.json();
  if (json.success && Array.isArray(json.indices)) {
    computeWeatherAndSignals(json.indices);
  } else {
    console.error('Error fetching indices:', json.error);
  }
}

run();
