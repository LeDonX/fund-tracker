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
    console.log('Sector indices count (should be 10):', sectors.length);
    sectors.forEach(sec => {
      console.log(`  - [${sec.symbol}] ${sec.name} | Price: ${sec.currentPrice} | Chg: ${sec.changePercent}% | Sparkline points: ${sec.sparkline.length}`);
    });
  } else {
    console.error('Error in response:', json.error);
  }
  
  console.log('\n==================================================');
  console.log('TEST 2: Fetching 1D Intraday Detail for Semiconductor ETF (512480.SS)');
  console.log('==================================================');
  
  const mockContextDetail = {
    request: {
      url: 'http://localhost/api/market?symbol=512480.SS&range=1d'
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
  console.log('TEST 3: Fetching 1D Intraday Detail with Mocked / Offline Fallback');
  console.log('==================================================');
  // We can test fallback by using a sector symbol that fails or runs offline
  // Since all 10 are valid, let's make sure they load cleanly
  const mockContextDetail2 = {
    request: {
      url: 'http://localhost/api/market?symbol=512690.SS&range=1d'
    }
  };
  
  const responseDetail2 = await onRequestGet(mockContextDetail2);
  const jsonDetail2 = await responseDetail2.json();
  console.log(`[512690.SS] Name: ${jsonDetail2.name} | Price: ${jsonDetail2.currentPrice} | Points: ${jsonDetail2.history?.length}`);
  console.log('==================================================');
}

run().catch(err => {
  console.error('Test execution failed:', err);
});
