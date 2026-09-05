import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(__dirname, '..', 'paths');

function splitRoute(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const teleportIndices = [];
  data.positions.forEach((pos, i) => {
    if (pos.type === 'teleport') teleportIndices.push(i);
  });

  if (teleportIndices.length <= 1) return false;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  const subRoutes = [];
  for (let i = 0; i < teleportIndices.length; i++) {
    const start = teleportIndices[i];
    const end = i + 1 < teleportIndices.length ? teleportIndices[i + 1] : data.positions.length;
    const positions = data.positions.slice(start, end);
    const suffix = String(i + 1).padStart(2, '0');

    const subData = JSON.parse(JSON.stringify(data));
    subData.positions = positions;
    subData.info.name = `${baseName}-${suffix}`;

    const subFileName = `${baseName}-${suffix}${ext}`;
    const subPath = path.join(dir, subFileName);
    fs.writeFileSync(subPath, JSON.stringify(subData, null, 2) + '\n');
    subRoutes.push(subFileName);
  }

  fs.unlinkSync(filePath);
  console.log(`Split: ${baseName} -> ${subRoutes.join(', ')}`);
  return true;
}

function processDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name.endsWith('.json')) {
      splitRoute(fullPath);
    }
  }
}

processDir(targetDir);

// 拆分后统一重排 id
console.log('\nReindexing positions...');
execSync('node "' + path.join(__dirname, 'reindex-positions.js') + '"', { stdio: 'inherit' });
console.log('Done.');
