const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const fetchPage = async (page, type) => {
    const url = `http://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=100&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:${type}&fields=f12,f14,f2,f3,f4,f62`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    return json?.data?.diff || [];
  };

  try {
    const allT2 = [];
    for (let p = 1; p <= 4; p++) {
      console.log(`Fetching t:2 page ${p}...`);
      try {
        const data = await fetchPage(p, 2);
        allT2.push(...data);
      } catch (e) {
        console.log(`Failed to fetch page ${p}:`, e.message);
      }
      await sleep(500);
    }
    
    console.log('\n--- T:2 Industry Sectors Search Results ---');
    console.log('Total successfully fetched t:2 sectors:', allT2.length);
    
    const targets = ['通信设备', '半导体', '计算机设备', '软件开发', '电子元件'];
    targets.forEach(name => {
      const match = allT2.find(item => item.f14 === name);
      if (match) {
        console.log(`  - Found: [${match.f12}] ${match.f14} | Chg: ${(parseFloat(match.f3)||0)/100}%`);
      } else {
        console.log(`  - ${name} NOT found in t:2!`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}
run();
