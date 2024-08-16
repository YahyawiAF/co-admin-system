import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

class MockDataGenerator {
  testFolderPath = path.join(os.homedir(), 'Desktop/Logs');
  numberOfFiles = 100;

  async generateMockJSONFiles() {
    if (!fs.existsSync(this.testFolderPath)) {
      fs.mkdirSync(this.testFolderPath);
    }

    for (let i = 1; i <= this.numberOfFiles; i++) {
      const fileName = `file_${i}.json`;
      const filePath = path.join(this.testFolderPath, fileName);
      const data = await fetch('https://dummyjson.com/products').then((res) => {
        return res.json();
      });
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    }
  }

  clearMockJSONFiles() {
    if (fs.existsSync(this.testFolderPath)) {
      fs.readdirSync(this.testFolderPath).forEach((file) => {
        fs.unlinkSync(path.join(this.testFolderPath, file));
      });
      fs.rmdirSync(this.testFolderPath);
      console.log('Mock JSON files cleared.');
    }
  }
}

const mockDataGenerator = new MockDataGenerator();
const command = process.argv[2];

if (command === 'generate') {
  mockDataGenerator.generateMockJSONFiles();
} else if (command === 'clear') {
  mockDataGenerator.clearMockJSONFiles();
} else {
  console.error(
    'Invalid command. Use "generate" to create mock data or "clear" to delete it.',
  );
}
