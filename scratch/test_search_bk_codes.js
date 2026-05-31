const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const fetchPage = async (page) => {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=100&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f62`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    return json?.data?.diff || [];
  };

  try {
    const pages = [];
    for (let p = 1; p <= 4; p++) {
      console.log(`Fetching page ${p}...`);
      const data = await fetchPage(p);
      pages.push(data);
      await sleep(300); // 300ms delay
    }
    
    const all = pages.flat();
    console.log('Total items fetched across 4 pages:', all.length);

    const targetCodes = ['BK0448', 'BK1036', 'BK0996', 'BK0447', 'BK1201'];
    console.log('\nSearching for target BK codes:');
    targetCodes.forEach(code => {
      const match = all.find(item => item.f12 === code);
      if (match) {
        console.log(`  - Found [${code}] ${match.f14} | Chg: ${(parseFloat(match.f3)||0)/100}%`);
      } else {
        console.log(`  - [${code}] NOT found!`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}
run();
