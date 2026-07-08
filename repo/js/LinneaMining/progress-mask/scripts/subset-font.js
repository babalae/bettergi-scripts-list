/**
 * @file 字体子集化脚本
 * 扫描项目源文件提取所有用到的字符 → 使用 fontmin 裁剪 zpix.ttf
 *
 * 用法:
 *   node scripts/subset-font.js            # 执行裁剪
 *   node scripts/subset-font.js --dry-run  # 仅打印提取的字符集，不裁剪
 */

import { createRequire } from 'module'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const Fontmin = require('fontmin')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC_DIR = join(ROOT, 'src')

// ===== 扫描配置 =====

/** 相对于 ROOT 的扫描目录 */
const SCAN_DIRS = [
  { dir: join(ROOT, '..'),           patterns: ['settings.json'] },
  { dir: join(ROOT, '..', 'paths'),  patterns: ['**/*.json'] },
  { dir: SRC_DIR,                    patterns: ['**/*.vue', '**/*.js', '**/*.css'] },
]

/** 保障字符集：即使源码中未扫描到也强制保留 */
const SAFETY_CHARS = [
  // ASCII 可打印字符
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
  // 常用 Unicode 标点
  '、。，．《》（）：；', // 、。，．《》（）：；
  '‘’“”—…',                         // ''""—…
  '！？',                                                  // ！？
  '°′″',                                            // °′″
  // 换行/空格类
  ' \n\r\t',
].join('')

// ===== 文件扫描 =====

/**
 * 递归获取目录下匹配 glob 的文件路径
 */
function walkDir(dir, exts) {
  const results = []
  if (!existsSync(dir)) return results

  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const st = statSync(fullPath)
    if (st.isDirectory()) {
      results.push(...walkDir(fullPath, exts))
    } else {
      const ext = extname(entry).toLowerCase()
      if (exts.includes(ext)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

/**
 * 从文件中提取所有非空白唯一字符
 */
function extractChars(filePath) {
  const text = readFileSync(filePath, 'utf-8')
  const chars = new Set()
  for (const ch of text) {
    if (ch.trim() !== '' || ch === ' ') {
      chars.add(ch)
    }
  }
  return chars
}

/**
 * 扫描所有配置的目录，返回去重后的字符数组
 */
function scanAllChars() {
  const allChars = new Set()

  // 先加入保障字符
  for (const ch of SAFETY_CHARS) {
    allChars.add(ch)
  }

  // 扫描目录
  for (const { dir, patterns } of SCAN_DIRS) {
    for (const pattern of patterns) {
      // 解析 ext 列表
      const exts = pattern.replace('**/*.', '').split('.')
      // 如果 pattern 是具体文件名
      if (!pattern.startsWith('**')) {
        const fullPath = join(dir, pattern)
        if (existsSync(fullPath)) {
          const chars = extractChars(fullPath)
          chars.forEach(c => allChars.add(c))
        }
        continue
      }
      // glob 模式
      const actualExts = exts.map(e => '.' + e)
      const files = walkDir(dir, actualExts)
      for (const file of files) {
        const chars = extractChars(file)
        chars.forEach(c => allChars.add(c))
      }
    }
  }

  return Array.from(allChars).sort()
}

// ===== 字体子集化 =====

function subsetFont(chars) {
  const text = chars.join('')
  const srcFont = join(SRC_DIR, 'fonts', 'zpix.ttf')
  const destDir = join(SRC_DIR, 'fonts')

  if (!existsSync(srcFont)) {
    console.error('[subset-font] 源字体文件不存在:', srcFont)
    process.exit(1)
  }

  console.log(`[subset-font] 字符集大小: ${chars.length} 个字符`)
  console.log(`[subset-font] 源字体: ${srcFont}`)
  console.log(`[subset-font] 输出目录: ${destDir}`)

  return new Promise((resolve, reject) => {
    const fontmin = new Fontmin()
      .src(srcFont)
      .dest(destDir)
      .use(Fontmin.glyph({ text }))

    fontmin.run((err, files) => {
      if (err) {
        console.error('[subset-font] 字体子集化失败:', err)
        reject(err)
        return
      }
      console.log('[subset-font] 字体子集化完成')
      if (files && files.length > 0) {
        for (const f of files) {
          console.log(`[subset-font]   输出: ${f.path} (${(f.contents.length / 1024).toFixed(1)} KB)`)
        }
      }
      resolve()
    })
  })
}

// ===== 主入口 =====

const dryRun = process.argv.includes('--dry-run')

async function main() {
  console.log('[subset-font] 开始扫描源文件...')
  const chars = scanAllChars()

  // 分类统计
  const cjkChars = chars.filter(c => {
    const code = c.codePointAt(0)
    return code >= 0x4E00 && code <= 0x9FFF
  })
  const asciiChars = chars.filter(c => c.codePointAt(0) < 128)
  const otherChars = chars.filter(c => {
    const code = c.codePointAt(0)
    return code >= 128 && !(code >= 0x4E00 && code <= 0x9FFF)
  })

  console.log(`[subset-font] 提取字符: ${chars.length} 个 (中文: ${cjkChars.length}, ASCII: ${asciiChars.length}, 其他: ${otherChars.length})`)
  console.log(`[subset-font] 中文字符: ${cjkChars.join('')}`)

  if (dryRun) {
    console.log('[subset-font] --dry-run 模式，不执行裁剪')
    return
  }

  await subsetFont(chars)
}

main().catch(err => {
  console.error('[subset-font] 执行失败:', err)
  process.exit(1)
})
