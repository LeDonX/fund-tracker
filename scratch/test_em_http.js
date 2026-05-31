async function run() {
  const url = 'http://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f62';
  console.log('Fetching via HTTP:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    console.log('Success! Total items fetched:', list.length);
    if (list.length > 0) {
      console.log('Item 1:', list[0]);
    }
  } catch (err) {
    console.error('HTTP Fetch Failed:', err);
  }
}
run();
