import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');

const tagRegex = /<(\/?[a-zA-Z0-9]+)(?:\s+[^>]*?)?(\/?)>/g;

let match;
const stack = [];
const lines = content.split('\n');

const getLineAndCol = (index) => {
  let chars = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + 1; // +1 for newline
    if (chars + lineLen > index) {
      return { line: i + 1, col: index - chars + 1 };
    }
    chars += lineLen;
  }
  return { line: lines.length, col: 1 };
};

const selfClosingTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);

let cleanContent = content;
cleanContent = cleanContent.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
cleanContent = cleanContent.replace(/\/\/.*/g, m => ' '.repeat(m.length));
cleanContent = cleanContent.replace(/'[^']*'/g, m => "'" + ' '.repeat(m.length - 2) + "'");
cleanContent = cleanContent.replace(/"[^"]*"/g, m => '"' + ' '.repeat(m.length - 2) + '"');
cleanContent = cleanContent.replace(/`[^`]*`/g, m => '`' + ' '.repeat(m.length - 2) + '`');

while ((match = tagRegex.exec(cleanContent)) !== null) {
  const tagName = match[1];
  const isSelfClosing = match[2] === '/' || selfClosingTags.has(tagName.toLowerCase());
  const isClosing = tagName.startsWith('/');
  const pos = getLineAndCol(match.index);

  if (isSelfClosing) {
    continue;
  }

  if (isClosing) {
    const cleanName = tagName.slice(1);
    if (stack.length === 0) {
      console.log(`Extra closing tag </${cleanName}> at line ${pos.line}, col ${pos.col}`);
    } else {
      const last = stack.pop();
      if (last.name !== cleanName) {
        console.log(`Mismatched closing tag </${cleanName}> at line ${pos.line}, col ${pos.col}. Expected </${last.name}> (opened at line ${last.pos.line}, col ${last.pos.col})`);
        stack.push(last);
      }
    }
  } else {
    stack.push({ name: tagName, pos });
  }
}

console.log('Unclosed tags remaining on stack:');
while (stack.length > 0) {
  const tag = stack.pop();
  console.log(`<${tag.name}> opened at line ${tag.pos.line}, col ${tag.pos.col}`);
}
