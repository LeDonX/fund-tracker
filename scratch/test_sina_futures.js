async function test() {
  const url = 'https://hq.sinajs.cn/list=hf_CHA50CFD';
  try {
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://finance.sina.com.cn/'
      }
    });
    const text = await res.text();
    console.log("Raw Response:", text);
    const match = text.match(/var\s+hq_str_[a-zA-Z0-9_]+\s*=\s*"([^"]*)"/);
    if (match && match[1]) {
      const parts = match[1].split(',');
      parts.forEach((val, idx) => {
        console.log(`[${idx}] => "${val}"`);
      });
    } else {
      console.log("No match found in response");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
