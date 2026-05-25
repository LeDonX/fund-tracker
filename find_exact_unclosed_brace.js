import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');

const stack = [];
let inString = null;
let inComment = null;

const lines = content.split('\n');

const getLineAndCol = (index) => {
  let chars = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + 1;
    if (chars + lineLen > index) {
      return { line: i + 1, col: index - chars + 1 };
    }
    chars += lineLen;
  }
  return { line: lines.length, col: 1 };
};

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const nextChar = content[i + 1];
  const pos = getLineAndCol(i);

  if (inComment) {
    if (inComment === '//' && char === '\n') {
      inComment = null;
    } else if (inComment === '/*' && char === '*' && nextChar === '/') {
      inComment = null;
      i++;
    }
    continue;
  }

  if (inString) {
    if (char === '\\') {
      i++;
    } else if (char === inString) {
      inString = null;
    } else if (inString === '`' && char === '$' && nextChar === '{') {
      stack.push({ type: 'template_expr', pos });
      i++;
      inString = null;
    }
    continue;
  }

  if (char === '/' && nextChar === '/') {
    inComment = '//';
    i++;
    continue;
  }
  if (char === '/' && nextChar === '*') {
    inComment = '/*';
    i++;
    continue;
  }

  if (char === '"' || char === "'" || char === '`') {
    inString = char;
    continue;
  }

  if (char === '{') {
    stack.push({ type: 'brace', pos });
  } else if (char === '}') {
    const last = stack.pop();
    if (last && last.type === 'template_expr') {
      inString = '`';
    }
  }
}

console.log('\nNesting complete. Remaining open blocks in stack:');
if (stack.length === 0) {
  console.log('None! All braces are balanced.');
} else {
  for (const block of stack) {
    const lineText = lines[block.pos.line - 1].trim();
    console.log(`- Unclosed { opened at Line ${block.pos.line}, Col ${block.pos.col}: "${lineText}"`);
  }
}
