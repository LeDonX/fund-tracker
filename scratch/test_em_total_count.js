async function run() {
  const getSectors = async (type) => {
    // Note: Use pz=500 to get everything
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:${type}&fields=f12,f14,f2,f3,f4,f62`;
    console.log(`\n--- Querying t:${type} with pz=500 ---`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    console.log(`Total items returned for t:${type}:`, list.length);
    
    // Check if BK0448 or BK1036 exist in this list
    const foundBK0448 = list.find(item => item.f12 === 'BK0448');
    const foundBK1036 = list.find(item => item.f12 === 'BK1036');
    console.log(`  BK0448 (通信设备) present: ${!!foundBK0448} ${foundBK0448 ? `| Name: ${foundBK0448.f14} | Chg: ${(parseFloat(foundBK0448.f3) || 0)/100}%` : ''}`);
    console.log(`  BK1036 (半导体) present: ${!!foundBK1036} ${foundBK1036 ? `| Name: ${foundBK1036.f14} | Chg: ${(parseFloat(foundBK1036.f3) || 0)/100}%` : ''}`);

    // If type === 2 (industry), let's print some losers
    if (type === 2) {
      const sortedAsc = [...list].sort((a, b) => (parseFloat(a.f3) || 0) - (parseFloat(b.f3) || 0));
      console.log('\nTop 15 worst performing industry sectors (Losers):');
      sortedAsc.slice(0, 15).forEach((item, idx) => {
        console.log(`[${idx + 1}] Code: ${item.f12} | Name: ${item.f14} | Chg: ${(parseFloat(item.f3) || 0) / 100}%`);
      });
    }
  };

  try {
    await getSectors(2); // industry
  } catch (err) {
    console.error(err);
  }
}
run();
