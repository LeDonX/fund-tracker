const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '../dist/assets');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
if (files.length > 0) {
  const file = path.join(cssDir, files[0]);
  const content = fs.readFileSync(file, 'utf8');
  
  const targets = ['text-8', 'text-9', 'text-10', 'text-11', 'text-12', 'text-13', 'text-14', 'text-15', 'text-16'];
  targets.forEach(t => {
    // Look for exact class pattern in minified CSS, like .text-8{
    const hasClass = content.includes(`.${t}{`) || content.includes(`\\.${t}{`);
    console.log(`Class .${t}{ is present:`, hasClass);
    
    // Find the definition
    const idx = content.indexOf(`.${t}{`);
    if (idx !== -1) {
      console.log(`  Definition of .${t}:`, content.substring(idx, idx + 40));
    }
  });
} else {
  console.log('No CSS files found!');
}
