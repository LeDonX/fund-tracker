async function run() {
  try {
    const res1 = await fetch('http://127.0.0.1:8788/api/stock-quotes?symbols=sh600519');
    console.log('Query 1 Status:', res1.status);
    const data1 = await res1.json();
    console.log('Query 1 Data:', JSON.stringify(data1, null, 2));

    const res2 = await fetch('http://127.0.0.1:8788/api/stock-quotes?symbols=sh600519&full=true');
    console.log('Query 2 (Full) Status:', res2.status);
    const data2 = await res2.json();
    console.log('Query 2 Data:', JSON.stringify(data2, null, 2));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
run();
