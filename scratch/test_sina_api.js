async function run() {
  const url = 'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?node=new_hybk&page=1&num=40&sort=changepercent&asc=0';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://finance.sina.com.cn/'
      }
    });
    const text = await res.text();
    console.log('Raw text response length:', text.length);
    console.log('Sample of raw response:', text.slice(0, 500));
    try {
      const data = JSON.parse(text);
      console.log('Successfully parsed JSON. Total sectors:', data.length);
      console.log('Top 10 sectors:');
      data.slice(0, 10).forEach((item, idx) => {
        console.log(`[${idx + 1}] Code: ${item.code} | Name: ${item.name} | Chg: ${item.percent}%`);
      });
    } catch (err) {
      console.log('JSON parse failed, trying to evaluate...');
      // Sina API keys are sometimes not double-quoted, let's fix it:
      // e.g. {symbol:"sinahy011000",code:"new_bl",name:"玻璃",trade:"0.000",pricechange:"0.000",changepercent:"0.000",...}
      try {
        const cleaned = text.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        const data = JSON.parse(cleaned);
        console.log('Successfully parsed cleaned JSON. Total sectors:', data.length);
        console.log('Top 10 sectors:');
        data.slice(0, 10).forEach((item, idx) => {
          console.log(`[${idx + 1}] Code: ${item.code || item.symbol} | Name: ${item.name} | Chg: ${item.percent || item.changepercent}%`);
        });
      } catch (err2) {
        console.log('Evaluation clean failed:', err2.message);
      }
    }
  } catch (err) {
    console.error('Error fetching Sina:', err);
  }
}

run();
