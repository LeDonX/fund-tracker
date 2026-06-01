async function run() {
  try {
    const res = await fetch('https://qt.gtimg.cn/q=s_sh600519');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Raw text:', JSON.stringify(text));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
run();
