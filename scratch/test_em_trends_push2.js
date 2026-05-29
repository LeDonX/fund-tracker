async function run() {
  const url = 'https://push2.eastmoney.com/api/qt/stock/trends/get?secid=90.BK0448&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1905350b3c72dee626ea4d8c6cd';
  console.log('Fetching Eastmoney push2 trends:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    console.log('Push2 response keys:', Object.keys(json));
    if (json.data) {
      console.log('Push2 data keys:', Object.keys(json.data));
      console.log('Name:', json.data.name);
      console.log('PrePrice:', json.data.prePrice);
      console.log('Trends count:', json.data.trends ? json.data.trends.length : 0);
      if (json.data.trends && json.data.trends.length > 0) {
        console.log('Sample trend point:', json.data.trends[0]);
      }
    }
  } catch (err) {
    console.error('Error fetching push2 trends:', err);
  }
}

run();
