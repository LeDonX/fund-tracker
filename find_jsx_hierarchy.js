import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');

let cleanContent = content;
cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
cleanContent = cleanContent.replace(/\/\/.*/g, m => m.replace(/[^\n]/g, ' '));
cleanContent = cleanContent.replace(/'[^']*'/g, m => m.replace(/[^\n]/g, ' '));
cleanContent = cleanContent.replace(/"[^"]*"/g, m => m.replace(/[^\n]/g, ' '));
cleanContent = cleanContent.replace(/`[^`]*`/g, m => m.replace(/[^\n]/g, ' '));

const lines = cleanContent.split('\n');
const stack = [];

const selfClosingTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);
const tagRegex = /<(\/?)([a-zA-Z0-9:]+)(?:\s+[^>]*?)?(\/?)>/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let match;
  
  tagRegex.lastIndex = 0;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const isSelfClosing = match[3] === '/' || selfClosingTags.has(tagName.toLowerCase());
    
    if (isSelfClosing) {
      continue;
    }
    
    if (isClosing) {
      const cleanName = tagName; // Corrected: tagName does not contain slash
      if (stack.length === 0) {
        console.log(`Line ${i + 1}: Extra closing tag </${cleanName}> when stack is empty! Content: "${content.split('\n')[i].trim()}"`);
      } else {
        const last = stack.pop();
        if (last.name !== cleanName) {
          console.log(`Line ${i + 1}: Mismatched closing tag </${cleanName}>. Expected </${last.name}> (opened at Line ${last.line}). Content: "${content.split('\n')[i].trim()}"`);
          stack.push(last);
        }
      }
    } else {
      stack.push({ name: tagName, line: i + 1 });
    }
  }
}

console.log('Unclosed tags at EOF:');
for (const tag of stack) {
  console.log(`Line ${tag.line}: <${tag.name}>`);
}
