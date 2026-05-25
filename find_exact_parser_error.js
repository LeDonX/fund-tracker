import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let parser;
try {
  // Try to load babel parser from vite or eslint plugins in node_modules
  parser = require('@babel/parser');
} catch (err) {
  try {
    parser = require('acorn');
  } catch (err2) {
    console.log('Failed to load parser:', err.message, err2.message);
    process.exit(1);
  }
}

const content = fs.readFileSync('src/App.jsx', 'utf8');

try {
  if (parser.parse) {
    // If it's @babel/parser
    parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } else {
    // If it's acorn
    parser.Parser.parse(content, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
  }
  console.log('Parsed successfully!');
} catch (err) {
  console.log('PARSER ERROR FOUND:');
  console.log(err.message);
  if (err.loc) {
    console.log(`Line: ${err.loc.line}, Col: ${err.loc.column}`);
    
    // Print the lines around the error
    const lines = content.split('\n');
    const start = Math.max(0, err.loc.line - 5);
    const end = Math.min(lines.length, err.loc.line + 5);
    console.log('\nContext around error:');
    for (let i = start; i < end; i++) {
      const marker = (i + 1 === err.loc.line) ? ' -> ' : '    ';
      console.log(`${marker}${i + 1}: ${lines[i]}`);
    }
  }
}
