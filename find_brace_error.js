import fs from 'fs';

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

let level = 0;
const stack = [];

// Simplified block tracking
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Ignore comments and strings roughly
  let cleanLine = line.replace(/\/\/.*$/, ''); // strip single-line comments
  
  // Track braces
  for (let j = 0; j < cleanLine.length; j++) {
    const char = cleanLine[j];
    if (char === '{') {
      level++;
      stack.push({ line: i + 1, content: line.trim() });
    } else if (char === '}') {
      level--;
      if (stack.length > 0) {
        stack.pop();
      } else {
        console.log(`Extra close brace } at line ${i + 1}: ${line.trim()}`);
      }
    }
  }
}

console.log(`Final nesting level: ${level}`);
if (stack.length > 0) {
  console.log('Unclosed braces stack (deepest first):');
  for (let i = stack.length - 1; i >= 0; i--) {
    console.log(`Line ${stack[i].line}: ${stack[i].content}`);
  }
}
