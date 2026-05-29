import { onRequestGet } from '../functions/api/market.js';

// Replicate frontend useMemo calculations exactly
function computeWeatherAndSignals(indices) {
  const a50Obj = indices.find(idx => idx.symbol === 'CN=F');
  const hxcObj = indices.find(idx => idx.symbol === '^HXC');
  const nqObj = indices.find(idx => idx.symbol === 'NQ=F');
  const esObj = indices.find(idx => idx.symbol === 'ES=F');

  const a50Val = a50Obj ? a50Obj.changePercent : 0.0;
  const hxcVal = hxcObj ? hxcObj.changePercent : 0.0;
  const nqVal = nqObj ? nqObj.changePercent : 0.0;
  const esVal = esObj ? esObj.changePercent : 0.0;

  console.log('\n--- Input Values ---');
  console.log(`A50 (CN=F) Change: ${a50Val}%`);
  console.log(`HXC (^HXC) Change: ${hxcVal}%`);
  console.log(`NQ (NQ=F) Change: ${nqVal}%`);
  console.log(`ES (ES=F) Change: ${esVal}%`);

  // China / A-shares advisor signal processing
  const f_a50_morning = Number(a50Val.toFixed(2));
  const hxc_last_night = Number(hxcVal.toFixed(2));
  const growth_sentiment = 0.4 * f_a50_morning + 0.6 * hxc_last_night;
  
  let activeRule = -1;
  let signal = "";
  let action = "";
  let label = "";
  
  // 决策 1：全面共振暴跌
  if (f_a50_morning <= -0.8 && hxc_last_night <= -1.5) {
    activeRule = 1;
    signal = "🔴 [严重警报] 大A与创业板今早将大幅低开！";
    action = "今日场外基金禁止加仓。场内ETF若想减仓，静待9:45左右的反抽高点，切勿在9:30开盘第一分钟割肉。";
    label = "共振暴跌";
  }
  // 决策 2：全面共振大涨
  else if (f_a50_morning >= 0.8 && hxc_last_night >= 1.5) {
    activeRule = 2;
    signal = "🟢 [多头逼空] 大A与创业板今早将大幅高开！";
    action = "情绪极其亢奋。场内ETF切勿开盘无脑追高（谨防高开低走）；场外基金如需建仓，可在下午14:30观察是否抱团封死阳线再做决定。";
    label = "多头逼空";
  }
  // 决策 3：存量博弈，结构分化
  else if (f_a50_morning >= 0.5 && hxc_last_night <= -1.0) {
    activeRule = 3;
    signal = "🟡 [二八分化] 传统蓝筹护盘，创业板承压！";
    action = "今天国家队可能会拉中字头、银行（A50强），但新能源、半导体等创业板权重（受中概拖累）会走弱。个股/行业基金各走各路，不宜盲目乱动。";
    label = "二八分化";
  }
  // 默认：震荡市
  else {
    activeRule = 4;
    signal = "⚪ [震荡市] 离岸市场波动微弱";
    action = "大A今天大概率维持震荡横盘，按照既定定投计划执行即可，无超额盘中交易机会。";
    label = "震荡整理";
  }

  // Jargon-free market weather indicators for Novice Mode
  let a50Weather = "⛅ 多云 (平稳没有大涨大跌)";
  let a50Emoji = "⛅";
  
  if (f_a50_morning >= 0.8) {
    a50Weather = "☀️ 晴天 (大上市公司强劲拉升)";
    a50Emoji = "☀️";
  } else if (f_a50_morning <= -0.8) {
    a50Weather = "🌧️ 雨天 (核心股票明显下跌)";
    a50Emoji = "🌧️";
  }
  
  let hxcWeather = "⛅ 多云 (科技股平稳整理)";
  let hxcEmoji = "⛅";
  
  if (hxc_last_night >= 1.5) {
    hxcWeather = "☀️ 晴天 (中概科技股超级大涨)";
    hxcEmoji = "☀️";
  } else if (hxc_last_night <= -1.5) {
    hxcWeather = "🌧️ 雨天 (中概科技股陷入大跌)";
    hxcEmoji = "🌧️";
  }

  const chinaStatusLabel = {
    '共振暴跌': '🌧️ 全线大跌 (雷雨天气)',
    '多头逼空': '☀️ 全线大涨 (晴空万里)',
    '二八分化': '⛅ 蓝筹涨、科技跌 (冷热不均)',
    '震荡整理': '☁️ 窄幅震荡 (微风轻拂)'
  }[label] || label;

  console.log('\n--- Calculated Advisor Outputs ---');
  console.log(`Active Rule: ${activeRule}`);
  console.log(`Label: ${label}`);
  console.log(`Signal: ${signal}`);
  console.log(`Action: ${action}`);
  console.log(`A50 Weather: ${a50Emoji} ${a50Weather}`);
  console.log(`HXC Weather: ${hxcEmoji} ${hxcWeather}`);
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
