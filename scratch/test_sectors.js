const fetch = globalThis.fetch || require('node-fetch');

async function fetchEastmoneySectors() {
  try {
    const fetchPage = async (page, type = 2) => {
      const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=100&po=1&np=1&ut=bd1d9ddb040893a3cf4fc3d054b7fc6b&flg=1&fid=f3&fs=m:90+t:${type}&fields=f12,f14,f2,f3,f4,f62`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://quote.eastmoney.com/'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      return json?.data?.diff || [];
    };

    const pages = await Promise.all([
      fetchPage(1, 2),
      fetchPage(2, 2),
      fetchPage(1, 3),
      fetchPage(2, 3)
    ]);
    
    const list = [];
    const seen = new Set();
    pages.flat().forEach(item => {
      if (item && item.f12 && item.f14 && !seen.has(item.f12)) {
        seen.add(item.f12);
        list.push(item);
      }
    });
    
    if (list.length === 0) {
      throw new Error('Fetched list is empty');
    }
    
    console.log('Successfully fetched from Eastmoney API. Sector count:', list.length);
    return list.slice(0, 10);
  } catch (err) {
    console.log('Failed to fetch from Eastmoney API, using fallback. Error:', err.message);
    const fallbackSectors = [
      { code: "BK1128", name: "CPO概念", baseChange: -4.50 },
      { code: "BK1130", name: "算力概念", baseChange: -5.20 },
      { code: "BK1340", name: "印制电路板", baseChange: -1.89 },
      { code: "BK0448", name: "通信设备", baseChange: -3.18 },
      { code: "BK1036", name: "半导体", baseChange: -6.40 },
      { code: "BK1201", name: "电子元件", baseChange: -2.39 },
      { code: "BK0996", name: "计算机设备", baseChange: -1.85 },
      { code: "BK0447", name: "软件开发", baseChange: -1.56 },
      { code: "BK0896", name: "证券", baseChange: 0.69 },
      { code: "BK0424", name: "酿酒行业", baseChange: 1.25 },
      { code: "BK0450", name: "电力设备", baseChange: 0.88 },
      { code: "BK0465", name: "化学制药", baseChange: -1.20 },
      { code: "BK0422", name: "汽车整车", baseChange: 0.45 },
      { code: "BK0425", name: "航天航空", baseChange: -2.10 },
      { code: "BK0437", name: "煤炭行业", baseChange: 1.85 },
      { code: "BK0478", name: "银行", baseChange: 0.22 },
      { code: "BK0451", name: "房地产开发", baseChange: 0.68 },
      { code: "BK0475", name: "有色金属", baseChange: -0.95 },
      { code: "BK0480", name: "生物制品", baseChange: -1.50 },
      { code: "BK0427", name: "商业百货", baseChange: 4.13 },
      { code: "BK0479", name: "医药商业", baseChange: -0.85 },
      { code: "BK0433", name: "光伏设备", baseChange: 0.92 }
    ];
    console.log('Fallback sectors count:', fallbackSectors.length);
    return fallbackSectors;
  }
}

fetchEastmoneySectors();
