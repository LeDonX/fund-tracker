import fs from 'fs';
import path from 'path';

async function runTest() {
  try {
    const imgPath = path.resolve('eg2.png');
    console.log(`Loading image from: ${imgPath}`);
    
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Image not found at ${imgPath}`);
    }
    
    const base64Data = fs.readFileSync(imgPath).toString('base64');
    console.log('Successfully converted image to Base64 (length:', base64Data.length, ')');
    
    console.log('Sending POST request to http://127.0.0.1:8788/api/ocr ...');
    
    const response = await fetch('http://127.0.0.1:8788/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Data,
        mimeType: 'image/png'
      })
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('Response JSON:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
