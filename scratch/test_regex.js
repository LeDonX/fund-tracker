const text = "v_s_sh600519=\"1~贵州茅台~600519~1309.60~-16.40~-1.24~43845~574113~~16371.07~GP-A~\";\n";
const lines = text.split(";").map(l => l.trim()).filter(Boolean);
for (const line of lines) {
  const match = line.match(/(?:var\s+)?v_([a-zA-Z0-9_\.]+)\s*=\s*"([^"]*)"/);
  console.log('Match found:', !!match);
  if (match) {
    console.log('Group 1 (fullKey):', match[1]);
    console.log('Group 2 (dataStr):', match[2]);
  }
}
