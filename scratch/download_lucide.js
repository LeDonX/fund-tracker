const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, '..', 'public', 'lucide-static');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
  'lucide.min.css',
  'lucide.woff2',
  'lucide.woff',
  'lucide.ttf'
];

const baseUrl = 'https://npm.elemecdn.com/lucide-static@0.300.0/font/';

function downloadFile(fileName) {
  return new Promise((resolve, reject) => {
    const fileUrl = baseUrl + fileName;
    const destPath = path.join(targetDir, fileName);
    const file = fs.createWriteStream(destPath);

    console.log(`Downloading ${fileUrl} -> ${destPath}`);
    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${fileName}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    for (const file of files) {
      await downloadFile(file);
    }
    console.log('All Lucide files downloaded successfully!');
  } catch (error) {
    console.error('Download failed:', error);
  }
}

main();
