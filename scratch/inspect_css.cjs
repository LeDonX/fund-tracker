const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '../dist/assets');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
if (files.length > 0) {
  const file = path.join(cssDir, files[0]);
  const content = fs.readFileSync(file, 'utf8');
  console.log('File size:', content.length);
  console.log('Contains text-10:', content.includes('text-10'));
  console.log('Contains font-size:10px:', content.includes('font-size:10px') || content.includes('font-size: 10px'));
  
  // Find where our custom utilities should be or search for any font-size definition
  const index = content.indexOf('font-size');
  if (index !== -1) {
    console.log('First font-size occurrence context:', content.substring(index - 50, index + 100));
  } else {
    console.log('No font-size keyword found in the CSS!');
  }
} else {
  console.log('No CSS files found in dist/assets!');
}
