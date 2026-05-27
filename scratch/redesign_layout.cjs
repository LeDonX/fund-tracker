const fs = require('fs');
const path = require('path');

const appJsxPath = path.join(__dirname, '../src/App.jsx');
const replacementBlockPath = path.join(__dirname, 'replacement_block.txt');

// Read and sanitize line endings to LF
let content = fs.readFileSync(appJsxPath, 'utf8').replace(/\r\n/g, '\n');
const replacement = fs.readFileSync(replacementBlockPath, 'utf8').replace(/\r\n/g, '\n');

// Start marker (exact matching with LF)
const startMarker = `  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 gap-6 h-full">`;

// End marker (exact matching with LF)
const endMarker = `      <FundDetailPanel
        isOpen={detailView.isOpen}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1) {
  console.error("Error: Could not find startMarker in App.jsx!");
  process.exit(1);
}
if (endIndex === -1) {
  console.error("Error: Could not find endMarker in App.jsx!");
  process.exit(1);
}

console.log("Start Index:", startIndex);
console.log("End Index:", endIndex);

const result = content.substring(0, startIndex) + replacement + "\n" + content.substring(endIndex);

// Save with native line endings (or keep as LF, Node on Windows handles both perfectly)
fs.writeFileSync(appJsxPath, result, 'utf8');
console.log("Successfully replaced layout block in App.jsx!");
