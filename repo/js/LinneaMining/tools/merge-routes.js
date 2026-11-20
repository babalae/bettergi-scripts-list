import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.join(__dirname, '..', 'paths');

function processDir(dir) {
  const groups = {};

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      processDir(path.join(dir, entry.name));
      continue;
    }
    if (!entry.name.endsWith('.json')) continue;

    // 匹配 parentName-XX.json
    const match = entry.name.match(/^(.+)-(\d{2})\.json$/);
    if (!match) continue;

    const parentBase = match[1];
    const subIndex = parseInt(match[2], 10);

    if (!groups[parentBase]) groups[parentBase] = [];
    groups[parentBase].push({ index: subIndex, fileName: entry.name, fullPath: path.join(dir, entry.name) });
  }

  for (const [parentBase, subs] of Object.entries(groups)) {
    subs.sort((a, b) => a.index - b.index);

    // 从第一个子路线继承 info
    const first = JSON.parse(fs.readFileSync(subs[0].fullPath, 'utf-8'));
    const parentData = JSON.parse(JSON.stringify(first));
    parentData.info.name = parentBase;

    // 拼接所有 positions 并合并去重 tags
    parentData.positions = [];
    const tags = new Set();
    for (const sub of subs) {
      const data = JSON.parse(fs.readFileSync(sub.fullPath, 'utf-8'));
      parentData.positions.push(...data.positions);
      if (Array.isArray(data.info.tags)) {
        data.info.tags.forEach(t => tags.add(t));
      }
    }
    parentData.info.tags = [...tags];

    const parentPath = path.join(dir, `${parentBase}.json`);
    fs.writeFileSync(parentPath, JSON.stringify(parentData, null, 2) + '\n');

    // 删除子路线
    for (const sub of subs) {
      fs.unlinkSync(sub.fullPath);
    }

    console.log(`Merge: ${subs.map(s => s.fileName).join(' + ')} -> ${parentBase}.json`);
  }
}

processDir(targetDir);

console.log('\nReindexing positions...');
execSync('node "' + path.join(__dirname, 'reindex-positions.js') + '"', { stdio: 'inherit' });
console.log('Done.');
