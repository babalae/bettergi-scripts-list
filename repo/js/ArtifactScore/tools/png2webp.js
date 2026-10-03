#!/usr/bin/env node
/**
 * README 图片压缩脚本
 *
 * 将 assets/images/readme 目录下的 PNG 图片以 80% 质量转为 WebP，
 * 转换成功后删除原 PNG 文件。
 *
 * 用法: node tools/png2webp.js
 * 依赖: npm install sharp
 */

import { readdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const README_DIR = resolve(__dirname, '..', 'assets', 'images', 'readme')
const QUALITY = 80

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('错误: 请先安装 sharp 依赖 —— npm install sharp')
    process.exit(1)
  }

  const pngFiles = readdirSync(README_DIR).filter(
    (file) => extname(file).toLowerCase() === '.png'
  )

  if (pngFiles.length === 0) {
    console.log('没有找到 PNG 文件，无需转换。')
    return
  }

  console.log(`找到 ${pngFiles.length} 个 PNG 文件，开始转换...\n`)

  for (const file of pngFiles) {
    const pngPath = resolve(README_DIR, file)
    const webpPath = resolve(README_DIR, basename(file, '.png') + '.webp')

    process.stdout.write(`${file}  →  ${basename(webpPath)} ... `)
    await sharp(pngPath)
      .webp({ quality: QUALITY })
      .toFile(webpPath)
    console.log('OK')

    unlinkSync(pngPath)
    console.log(`  已删除原图: ${file}`)
  }

  console.log(`\n完成! 共转换 ${pngFiles.length} 个文件。`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
