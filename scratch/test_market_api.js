import { onRequestGet } from '../functions/api/market.js';

async function run() {
  console.log('==================================================');
  console.log('TEST 1: Fetching Overview Summary (/api/market)');
  console.log('==================================================');
  
  const mockContext = {
    request: {
      url: 'http://localhost/api/market'
    }
  };
  
  const response = await onRequestGet(mockContext);
  const json = await response.json();
  
  console.log('API Response Status:', response.status);
  console.log('Success:', json.success);
  console.log('Timestamp:', json.timestamp ? new Date(json.timestamp).toLocaleString() : 'N/A');
  console.log('Total indices returned:', json.indices ? json.indices.length : 0);
  
  if (json.success && Array.isArray(json.indices)) {
    const sectors = json.indices.filter(idx => idx.region === 'SEC');
    console.log('Sector indices count (should be ~70+):', sectors.length);
    console.log('Top 10 returned sectors:');
    sectors.slice(0, 10).forEach(sec => {
      console.log(`  - [${sec.symbol}] ${sec.name} | Price: ${sec.currentPrice} | Chg: ${sec.changePercent}% | Sparkline points: ${sec.sparkline.length}`);
    });
  } else {
    console.error('Error in response:', json.error);
  }
  
  console.log('\n==================================================');
  console.log('TEST 2: Fetching 1D Intraday Detail for Telecom Sector (BK0448)');
  console.log('==================================================');
  
  const mockContextDetail = {
    request: {
      url: 'http://localhost/api/market?symbol=BK0448&range=1d'
    }
  };
  
  const responseDetail = await onRequestGet(mockContextDetail);
  const jsonDetail = await responseDetail.json();
  
  console.log('Detail API Response Status:', responseDetail.status);
  console.log('Success:', jsonDetail.success);
  console.log('Symbol:', jsonDetail.symbol);
  console.log('Name:', jsonDetail.name);
  console.log('Current Price:', jsonDetail.currentPrice);
  console.log('Price Change:', jsonDetail.change);
  console.log('Price Change Percent:', jsonDetail.changePercent);
  console.log('History point count:', jsonDetail.history ? jsonDetail.history.length : 0);
  
  if (jsonDetail.success && Array.isArray(jsonDetail.history) && jsonDetail.history.length > 0) {
    console.log('First history point:', jsonDetail.history[0]);
    console.log('Last history point (should force-align with real-time/now):', jsonDetail.history[jsonDetail.history.length - 1]);
  } else {
    console.error('Error or no history returned:', jsonDetail.error);
  }
  
  console.log('\n==================================================');
  console.log('TEST 3: Fetching 1Y Historical Daily K-line for Semiconductor (BK1036)');
  console.log('==================================================');
  
  const mockContextDetail2 = {
    request: {
      url: 'http://localhost/api/market?symbol=BK1036&range=1y'
    }
  };
  
  const responseDetail2 = await onRequestGet(mockContextDetail2);
  const jsonDetail2 = await responseDetail2.json();
  
  console.log('History API Response Status:', responseDetail2.status);
  console.log('Success:', jsonDetail2.success);
  console.log('Symbol:', jsonDetail2.symbol);
  console.log('Name:', jsonDetail2.name);
  console.log('Current Price:', jsonDetail2.currentPrice);
  console.log('Price Change:', jsonDetail2.change);
  console.log('Price Change Percent:', jsonDetail2.changePercent);
  console.log('History point count:', jsonDetail2.history ? jsonDetail2.history.length : 0);
  
  if (jsonDetail2.success && Array.isArray(jsonDetail2.history) && jsonDetail2.history.length > 0) {
    console.log('First history point:', jsonDetail2.history[0]);
    console.log('Last history point:', jsonDetail2.history[jsonDetail2.history.length - 1]);
  } else {
    console.error('Error or no history returned:', jsonDetail2.error);
  }
  console.log('==================================================');
}

run().catch(err => {
  console.error('Test execution failed:', err);
});
