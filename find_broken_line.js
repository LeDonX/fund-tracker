import fs from 'fs';

const diffContent = fs.readFileSync('commit_diff.txt', 'utf8');
const lines = diffContent.split('\n');

let braceLevel = 0;
let parenLevel = 0;

console.log('Tracing brace and paren levels line-by-line in commit diff...');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('@@')) {
    console.log(`\nDiff Hunk Context: ${line}`);
  }
  
  if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
    const isAdded = line.startsWith('+');
    const factor = isAdded ? 1 : -1;
    const cleanLine = line.slice(1).replace(/\/\/.*$/, ''); // strip sign and comments
    
    let lineBraceChange = 0;
    let lineParenChange = 0;
    
    for (let j = 0; j < cleanLine.length; j++) {
      const char = cleanLine[j];
      if (char === '{') lineBraceChange += factor;
      else if (char === '}') lineBraceChange -= factor;
      else if (char === '(') lineParenChange += factor;
      else if (char === ')') lineParenChange -= factor;
    }
    
    braceLevel += lineBraceChange;
    parenLevel += lineParenChange;
    
    if (lineBraceChange !== 0 || lineParenChange !== 0) {
      const sign = isAdded ? '+' : '-';
      console.log(`[Braces: ${braceLevel} (${lineBraceChange >= 0 ? '+' : ''}${lineBraceChange}), Parens: ${parenLevel} (${lineParenChange >= 0 ? '+' : ''}${lineParenChange})] Line in diff: ${sign} ${cleanLine.trim()}`);
    }
  }
}
