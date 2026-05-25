import fs from 'fs';
const content = fs.readFileSync('src/App.jsx', 'utf8');
const count = (content.match(/`/g) || []).length;
console.log('Backtick count:', count);
