const obj = { changePercent: NaN };
const jsonStr = JSON.stringify(obj);
console.log('JSON String:', jsonStr);
const parsed = JSON.parse(jsonStr);
console.log('Parsed:', parsed);
console.log('typeof changePercent:', typeof parsed.changePercent);
try {
  const val = parsed.changePercent;
  val.toFixed(2);
} catch (e) {
  console.error('Crash caught:', e.message);
}
