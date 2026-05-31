async function run() {
  const getPage = async (page) => {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=100&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f62`;
    console.log(`\n--- Fetching Page ${page} ---`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    console.log(`Page ${page} total items returned:`, list.length);
    if (list.length > 0) {
      console.log(`First 3 items:`);
      list.slice(0, 3).forEach((item, idx) => {
        console.log(`  [${idx + 1}] Code: ${item.f12} | Name: ${item.f14} | Chg: ${(parseFloat(item.f3) || 0)/100}%`);
      });
      console.log(`Last 3 items:`);
      list.slice(-3).forEach((item, idx) => {
        console.log(`  [${idx + 1}] Code: ${item.f12} | Name: ${item.f14} | Chg: ${(parseFloat(item.f3) || 0)/100}%`);
      });
    }
    return list;
  };

  try {
    const p1 = await getPage(1);
    const p2 = await getPage(2);
    const p3 = await getPage(3);
    
    // Check if there is overlap
    const p1Codes = new Set(p1.map(item => item.f12));
    const p2Overlap = p2.filter(item => p1Codes.has(item.f12));
    console.log(`\nOverlap between Page 1 and Page 2:`, p2Overlap.length);
  } catch (err) {
    console.error(err);
  }
}
run();
