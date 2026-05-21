const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, '..', 'public', 'lucide-static');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
  'lucide.css',
  'lucide.woff2',
  'lucide.woff',
  'lucide.ttf'
];

// Try Zhihu's fast unpkg mirror first, then fallback to unpkg.com
const mirrors = [
  'https://unpkg.zhimg.com/lucide-static@0.300.0/font/',
  'https://unpkg.com/lucide-static@0.300.0/font/'
];

function downloadFile(mirrorUrl, fileName) {
  return new Promise((resolve, reject) => {
    const fileUrl = mirrorUrl + fileName;
    const destPath = path.join(targetDir, fileName);
    const file = fs.createWriteStream(destPath);

    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to get '${fileName}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${fileName} from ${mirrorUrl}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function downloadWithFallback(fileName) {
  for (const mirror of mirrors) {
    try {
      console.log(`Trying to download ${fileName} from ${mirror}...`);
      await downloadFile(mirror, fileName);
      return; // Success!
    } catch (err) {
      console.warn(`Failed downloading ${fileName} from ${mirror}: ${err.message}`);
    }
  }
  throw new Error(`All mirrors failed for ${fileName}`);
}

async function main() {
  try {
    for (const file of files) {
      await downloadWithFallback(file);
    }
    console.log('All Lucide files downloaded successfully!');
  } catch (error) {
    console.error('Download failed:', error);
  }
}

main();
