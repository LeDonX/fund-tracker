async function test() {
  const symbols = ['gb_hxc', 'gb_ixic'];
  const url = `https://hq.sinajs.cn/list=${symbols.join(',')}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://finance.sina.com.cn/'
      }
    });
    const text = await res.text();
    console.log("SINA RESPONSE:\n", text);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
