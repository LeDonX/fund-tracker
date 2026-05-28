async function run() {
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f5,f6,f62,f152,f184,f300';
  console.log('Fetching Eastmoney sectors:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    console.log('Successfully fetched and parsed Eastmoney data. Total sectors returned:', list.length);
    if (list.length > 0) {
      console.log('Top 15 sectors by price change (fields map: f12=code, f14=name, f3=changePercent, f2=price):');
      list.slice(0, 15).forEach((item, idx) => {
        console.log(`[${idx + 1}] Code: ${item.f12} | Name: ${item.f14} | Price: ${item.f2} | Chg: ${item.f3}% | MainNetInflow: ${item.f62}`);
      });
      
      // Let's search if CPO/通信/PCB/算力 are in the returned list
      console.log('\nChecking if CPO/通信/PCB/算力 are present in the returned list:');
      const searchKeywords = ['通信', '计算机', '电子', '半导体', '软件'];
      list.forEach(item => {
        const name = item.f14;
        const matched = searchKeywords.some(kw => name.includes(kw));
        if (matched) {
          console.log(`  - Matched Sector: [${item.f12}] ${name} | Chg: ${item.f3}%`);
        }
      });
    }
  } catch (err) {
    console.error('Error fetching Eastmoney:', err);
  }
}

run();
