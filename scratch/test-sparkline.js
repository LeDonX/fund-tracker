// Seeded deterministic random number generator for coherent sparkline waves
function getSeededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return function() {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

let mockHour = 10;
let mockMinute = 30;

// Mocked helper to get timezone-specific Date object components
function getMarketTimeParts(symbol) {
  return {
    year: 2026,
    month: 6,
    day: 3,
    hour: mockHour,
    minute: mockMinute,
    second: 0,
    dayOfWeek: 3 // Wednesday
  };
}

function getMarketCurrentDateStr(symbol) {
  const parts = getMarketTimeParts(symbol);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getFullDayTimeline(symbol) {
  const minutes = [];
  const addMinutes = (startH, startM, endH, endM, step) => {
    let h = startH;
    let m = startM;
    while (h < endH || (h === endH && m <= endM)) {
      minutes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += step;
      if (m >= 60) {
        h += Math.floor(m / 60);
        m = m % 60;
      }
    }
  };

  const step = 1;
  addMinutes(9, 30, 11, 31, step);
  addMinutes(13, 0, 15, 2, step);
  return minutes;
}

function reconstructIntradayHistory(item) {
  if (!item || !item.symbol) return [];
  
  const symbol = item.symbol;
  const currentPrice = item.currentPrice || 0;
  const changePercent = item.changePercent || 0;
  const change = item.change || 0;
  const prevClose = currentPrice - change;
  
  const marketToday = getMarketCurrentDateStr(symbol);
  const fullTimeline = getFullDayTimeline(symbol);
  
  const parts = getMarketTimeParts(symbol);
  const nowHour = parts.hour;
  const nowMinute = parts.minute;
  const nowDayOfWeek = parts.dayOfWeek;

  const isWeekend = nowDayOfWeek === 0 || nowDayOfWeek === 6;
  
  let currentIndex = -1;
  
  if (isWeekend) {
    currentIndex = fullTimeline.length - 1;
  } else {
    const currentTimeStr = `${String(nowHour).padStart(2, '0')}:${String(nowMinute).padStart(2, '0')}`;
    for (let i = fullTimeline.length - 1; i >= 0; i--) {
      if (fullTimeline[i] <= currentTimeStr) {
        currentIndex = i;
        break;
      }
    }
  }
  
  if (currentIndex < 0) {
    return [];
  }
  
  const history = [];
  const step = 5;
  const rand = getSeededRandom(symbol);
  
  for (let i = 0; i <= currentIndex; i += step) {
    const t = currentIndex > 0 ? i / currentIndex : 0;
    let val = prevClose + t * (currentPrice - prevClose);
    
    if (currentIndex > 0) {
      const wave1 = Math.sin(t * Math.PI * 2) * (currentPrice * 0.003) * (rand() - 0.5);
      const wave2 = Math.sin(t * Math.PI * 5) * (currentPrice * 0.0015) * (rand() - 0.5);
      const wave3 = Math.sin(t * Math.PI * 10) * (currentPrice * 0.0008) * (rand() - 0.5);
      val += wave1 + wave2 + wave3;
    }
    
    history.push({
      date: `${marketToday}T${fullTimeline[i]}:00.000Z`,
      time: fullTimeline[i],
      value: Number(val.toFixed(2))
    });
  }
  
  if (currentIndex % step !== 0) {
    history.push({
      date: `${marketToday}T${fullTimeline[currentIndex]}:00.000Z`,
      time: fullTimeline[currentIndex],
      value: currentPrice
    });
  }
  
  return history;
}

// Test deterministic
const item = { symbol: "000001.SS", currentPrice: 3000, change: 15 };
const h1 = reconstructIntradayHistory(item);

// Run again with the same mock time
const h2 = reconstructIntradayHistory(item);
console.log("Length:", h1.length);
console.log("Length match:", h1.length === h2.length);
if (h1.length > 0 && h2.length > 0) {
  console.log("First values match:", h1[0].value === h2[0].value);
  console.log("Last values match:", h1[h1.length - 1].value === h2[h2.length - 1].value);
  let allMatch = true;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i].value !== h2[i].value) {
      allMatch = false;
      break;
    }
  }
  console.log("All points match:", allMatch);
}

// Now simulate a slightly later time (e.g. 10:31 AM) to see if values at i = 10 match
console.log("\n--- Advancing time by 1 minute ---");
mockMinute = 31;
const h3 = reconstructIntradayHistory(item);
console.log("Length h3:", h3.length);
console.log("h1[2] (i=10) value:", h1[2].value);
console.log("h3[2] (i=10) value:", h3[2].value);
console.log("Point at index 2 matches:", h1[2].value === h3[2].value);
