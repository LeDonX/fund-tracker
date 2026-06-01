async function run() {
  try {
    const res = await fetch('http://127.0.0.1:8788/api/market');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Success:', data.success);
    if (data.indices) {
      console.log('Indices count:', data.indices.length);
    } else {
      console.log('No indices, data:', data);
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
run();
