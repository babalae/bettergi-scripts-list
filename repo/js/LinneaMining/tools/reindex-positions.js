import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(__dirname, '..', 'paths');

function reindexPositions(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      reindexPositions(fullPath);
    } else if (entry.name.endsWith('.json')) {
      let raw = fs.readFileSync(fullPath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
        fs.writeFileSync(fullPath, raw, 'utf-8');
        console.log(`Removed BOM: ${path.relative(targetDir, fullPath)}`);
      }
      const data = JSON.parse(raw);

      if (!data.positions || !Array.isArray(data.positions)) continue;

      let changed = false;
      data.positions.forEach((pos, i) => {
        if (pos.id !== i + 1) {
          pos.id = i + 1;
          changed = true;
        }
      });

      if (changed) {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
        console.log(`Reindexed: ${path.relative(targetDir, fullPath)} (${data.positions.length} positions)`);
      }
    }
  }
}

reindexPositions(targetDir);
console.log('Done.');
