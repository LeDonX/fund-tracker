async function test() {
  const code = '024434';
  const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const js = await res.text();
    
    // Find the Data_grandTotal line
    const match = js.match(/var\s+Data_grandTotal\s*=\s*([\s\S]*?);/);
    if (match) {
      const dataStr = match[1].trim();
      const dataObj = JSON.parse(dataStr);
      console.log('Data_grandTotal elements count:', dataObj.length);
      dataObj.forEach((item, index) => {
        console.log(`Element ${index}: name = "${item.name}", data points count = ${item.data.length}`);
      });
    } else {
      console.log('Data_grandTotal not found');
    }
  } catch (err) {
    console.error('Error fetching', url, err.message);
  }
}

test();
