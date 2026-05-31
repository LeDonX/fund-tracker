async function run() {
  // Let's fetch industry sectors (t:2) first with pz=200
  const urlInd = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f62';
  console.log('Fetching industry sectors (t:2) with pz=200...');
  try {
    const res = await fetch(urlInd, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    console.log('Total industry sectors returned:', list.length);
    
    // Sort ascending (worst performers first) to see the losers!
    const sortedAsc = [...list].sort((a, b) => (parseFloat(a.f3) || 0) - (parseFloat(b.f3) || 0));
    console.log('\nTop 10 worst performing industry sectors (Losers):');
    sortedAsc.slice(0, 10).forEach((item, idx) => {
      console.log(`[${idx + 1}] Code: ${item.f12} | Name: ${item.f14} | Chg: ${(parseFloat(item.f3) || 0) / 100}%`);
    });

    console.log('\nChecking if CPO/通信/PCB/算力/半导体 are in this list:');
    const keywords = ['通信', '半导体', '电子元件', '计算机', '软件', 'cpo', 'pcb', '算力'];
    list.forEach(item => {
      const name = item.f14.toLowerCase();
      if (keywords.some(kw => name.includes(kw))) {
        console.log(`  - Found: [${item.f12}] ${item.f14} | Chg: ${(parseFloat(item.f3) || 0) / 100}%`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}
run();
