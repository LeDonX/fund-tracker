const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src');

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const map = {
        'text-\\[8px\\]': 'text-8',
        'text-\\[8\\.5px\\]': 'text-8',
        'text-\\[9px\\]': 'text-9',
        'text-\\[9\\.5px\\]': 'text-9',
        'text-\\[10px\\]': 'text-10',
        'text-\\[10\\.5px\\]': 'text-10',
        'text-\\[11px\\]': 'text-11',
        'text-\\[11\\.5px\\]': 'text-11',
        'text-\\[12px\\]': 'text-12',
        'text-\\[12\\.5px\\]': 'text-12',
        'text-\\[13px\\]': 'text-13',
        'text-\\[13\\.5px\\]': 'text-13',
        'text-\\[14px\\]': 'text-14',
        'text-\\[14\\.5px\\]': 'text-14',
        'text-\\[15px\\]': 'text-15',
        'text-\\[15\\.5px\\]': 'text-15',
        'text-\\[16px\\]': 'text-16'
      };

      let modified = false;
      for (const [key, value] of Object.entries(map)) {
        const regex = new RegExp(key, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, value);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

walk(dir);
console.log('Done!');
