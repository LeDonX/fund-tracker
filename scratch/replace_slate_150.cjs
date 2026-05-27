const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/App.jsx',
  'src/components/forms/AddFundModal.jsx',
  'src/components/forms/EditFundModal.jsx',
  'src/components/market/GlobalMarketPanel.jsx',
  'src/components/modals/HistoryModal.jsx',
  'src/components/modals/OcrSyncModal.jsx',
  'src/components/modals/ProfitCalendarModal.jsx'
];

targetFiles.forEach(file => {
  const absolutePath = path.join(__dirname, '../', file);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(absolutePath, 'utf8');
  if (content.includes('slate-150')) {
    // Replace all occurrences of slate-150 with slate-200
    const countBefore = (content.match(/slate-150/g) || []).length;
    content = content.replace(/slate-150/g, 'slate-200');
    fs.writeFileSync(absolutePath, content, 'utf8');
    console.log(`Successfully replaced ${countBefore} occurrences of slate-150 in ${file}`);
  } else {
    console.log(`No occurrences of slate-150 found in ${file}`);
  }
});

console.log("Global border-slate-150 fix completed successfully!");
