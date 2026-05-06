此目录下的文件为工具脚本，与主脚本的运行无关，仅用于开发时批量处理路线信息。

所有命令均从项目根目录运行。

---

## split-routes.js
将包含多个传送点（`teleport`）的路线拆分为独立子路线，方便打 tag 管理。

```bash
node repo/js/LinneaMining/tools/split-routes.js
```

拆分后自动运行 `reindex-positions.js`。

## merge-routes.js
将拆分后的子路线（`名称-01.json`、`名称-02.json`...）重新合并为父路线，tags 自动合并去重。

```bash
node repo/js/LinneaMining/tools/merge-routes.js
```

合并后自动运行 `reindex-positions.js`。

## reindex-positions.js
将所有路线文件中 positions 的 `id` 按数组顺序重新赋值（1, 2, 3...），附带 BOM 清理。

```bash
node repo/js/LinneaMining/tools/reindex-positions.js
```

## update-bgi-version.js
批量更新路线文件中 `info.bgi_version`，补充缺失的 `info.version`，附带 BOM 清理。修改脚本中的 `newVersion` 常量后运行。

```bash
node repo/js/LinneaMining/tools/update-bgi-version.js
```

## rename-tag.js
将路线文件中匹配指定 tag 替换为新 tag（精确匹配单个元素）。修改脚本中的 `oldTag` 和 `newTag` 后运行。

```bash
node repo/js/LinneaMining/tools/rename-tag.js
```

## cleanup-fields.js
批量删除路线文件中的 `config` 和 `farming_info` 字段，附带 BOM 清理。

```bash
node repo/js/LinneaMining/tools/cleanup-fields.js
```
