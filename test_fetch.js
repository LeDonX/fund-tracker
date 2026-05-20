async function test() {
  const code = '024434';
  
  const urls = [
    `https://fundgz.eastmoney.com/js/${code}.js`,
    `https://fundgz.1234567.com.cn/js/${code}.js`,
    `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
    `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=2`
  ];
  
  for (const url of urls) {
    try {
      console.log(`\n--- Fetching: ${url} ---`);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Content (first 300 chars):', text.slice(0, 300));
    } catch (err) {
      console.error('Error fetching', url, err.message);
    }
  }
}

test();
