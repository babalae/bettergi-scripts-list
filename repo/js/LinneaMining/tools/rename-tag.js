import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(__dirname, '..', 'paths');

const oldTag = '铁矿';
const newTag = '铁块';

function processDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name.endsWith('.json')) {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.info.tags)) continue;

      const idx = data.info.tags.indexOf(oldTag);
      if (idx === -1) continue;

      data.info.tags[idx] = newTag;
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
      console.log(`${path.relative(targetDir, fullPath)}: ${oldTag} -> ${newTag}`);
    }
  }
}

if (!oldTag || !newTag) {
  console.log('Please set oldTag and newTag in the script.');
  process.exit(1);
}

processDir(targetDir);
console.log('Done.');
