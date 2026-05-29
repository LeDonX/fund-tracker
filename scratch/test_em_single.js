async function run() {
  const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=90.BK0448&fields=f57,f58,f43,f169';
  console.log('Fetching Eastmoney single quote:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    console.log('Single quote response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error fetching Eastmoney single quote:', err);
  }
}

run();
