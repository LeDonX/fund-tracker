async function run() {
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.BK0448&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=120';
  console.log('Fetching Eastmoney daily klines:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const klines = json?.data?.klines || [];
    console.log('Successfully fetched Eastmoney daily klines. Total points:', klines.length);
    if (klines.length > 0) {
      console.log('First kline point (raw string):', klines[0]);
      console.log('Last kline point (raw string):', klines[klines.length - 1]);
    }
  } catch (err) {
    console.error('Error fetching Eastmoney kline:', err);
  }
}

run();
