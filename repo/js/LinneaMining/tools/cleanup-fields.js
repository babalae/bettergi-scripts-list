import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(__dirname, '..', 'paths');

const fieldsToRemove = ['config', 'farming_info'];

function processDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name.endsWith('.json')) {
      let raw = fs.readFileSync(fullPath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
        fs.writeFileSync(fullPath, raw, 'utf-8');
        console.log(`Removed BOM: ${path.relative(targetDir, fullPath)}`);
      }
      const data = JSON.parse(raw);
      let changed = false;

      for (const field of fieldsToRemove) {
        if (data[field] !== undefined) {
          delete data[field];
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
        console.log(`Cleaned: ${path.relative(targetDir, fullPath)}`);
      }
    }
  }
}

processDir(targetDir);
console.log('Done.');
