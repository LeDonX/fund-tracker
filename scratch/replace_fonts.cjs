const fs = require('fs');
const path = require('path');

const mappings = {
  'text-[8px]': 'text-2xs',
  'text-[8.5px]': 'text-2xs',
  'text-[9px]': 'text-2xs',
  'text-[9.5px]': 'text-2xs',
  'text-[10px]': 'text-2xs',
  'text-[10.5px]': 'text-2xs',
  'text-[11px]': 'text-xs',
  'text-[11.5px]': 'text-xs',
  'text-[12.5px]': 'text-xs',
  'text-[13px]': 'text-xs',
  'text-[13.5px]': 'text-sm',
  'text-[14px]': 'text-sm',
  'text-[14.5px]': 'text-sm',
  'text-[15px]': 'text-base',
  'text-[15.5px]': 'text-base'
};

const glob = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(glob(file));
    } else if (file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
};

const run = () => {
  console.log('Starting typography cleanup...');
  const files = glob('src');
  let totalReplacements = 0;

  files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let modified = false;
    let fileReplacements = 0;

    Object.keys(mappings).forEach(key => {
      const regex = new RegExp(key.replace(/[-\[\]]/g, '\\$&'), 'g');
      const val = mappings[key];
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, val);
        modified = true;
        fileReplacements += matches.length;
        totalReplacements += matches.length;
      }
    });

    if (modified) {
      fs.writeFileSync(f, content, 'utf8');
      console.log(`Updated ${f}: ${fileReplacements} replacements.`);
    }
  });

  console.log(`Total replacements in JSX files: ${totalReplacements}`);

  // Modify index.css to add @theme styling for text-2xs
  const cssFile = 'src/index.css';
  let cssContent = fs.readFileSync(cssFile, 'utf8');
  if (!cssContent.includes('--font-size-2xs')) {
    // Add @theme block
    const themeBlock = `
@theme {
  --font-size-2xs: 10px;
}
`;
    cssContent = cssContent.replace('@import "tailwindcss";', `@import "tailwindcss";\n${themeBlock}`);
    fs.writeFileSync(cssFile, cssContent, 'utf8');
    console.log('Added --font-size-2xs (10px) to src/index.css @theme block.');
  } else {
    console.log('--font-size-2xs already defined in src/index.css');
  }
};

run();
