#!/usr/bin/env python3
"""Audit BetterGI script submission conventions and write a Markdown report.

This tool complements, rather than replaces, the existing build tools:
- build/build.js generates repo.json and extracts metadata.
- build/validate.py validates/fixes pathing JSON structure and fields.

The audit focuses on README naming/packaging conventions across combat,
pathing, and js scripts, including checks that require repository-wide context.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SEVERITIES = ("ERROR", "WARNING", "MANUAL_REVIEW")
README_PATHING_CATEGORIES = {"锄地专区", "地方特产", "敌人与魔物", "矿物", "其他"}
# README text says "six" categories, but currently lists the five above explicitly.
README_LISTED_CATEGORY_RULE = "README: 地图追踪脚本一级分类应为 `锄地专区`、`地方特产`、`敌人与魔物`、`矿物`、`其他`"

RESOURCE_DIR_NAMES = {"assets", "asset", "resources", "resource"}
COMBAT_AUTHOR_EXACT = re.compile(r"^//作者：\S.+")
COMBAT_AUTHOR_LOOSE = re.compile(r"^//\s*(?:原作者|作者)\s*[:：].+")
PATHING_NUMBER_PREFIX = re.compile(r"^(?:[A-Za-z]\d{2,3}|\d{2,3})-")
PATHING_QUANTITY = re.compile(r"\d+(?:[~～\-–—]\d+)?\+?(个|只|朵|条|株)(?=$|[-;，,、（）()\[\]【】\s])")


@dataclass(frozen=True)
class Finding:
    severity: str
    type: str
    path: str
    rule: str
    problem: str
    suggested_fix: str
    downgraded_from: str | None = None


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def md_escape(value: object) -> str:
    text = str(value).replace("\n", "<br>")
    return text.replace("|", "\\|")


def add(
    findings: list[Finding],
    severity: str,
    typ: str,
    path: str,
    rule: str,
    problem: str,
    fix: str,
    downgraded_from: str | None = None,
) -> None:
    findings.append(Finding(severity, typ, path, rule, problem, fix, downgraded_from))


def require_scopes(root: Path) -> tuple[Path, Path, Path]:
    combat = root / "repo" / "combat"
    pathing = root / "repo" / "pathing"
    js = root / "repo" / "js"
    missing = [p.as_posix() for p in (combat, pathing, js) if not p.is_dir()]
    if missing:
        raise SystemExit(f"ERROR: required scan scope not found: {', '.join(missing)}")
    return combat, pathing, js


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig", errors="replace")
    except OSError as exc:
        return f"__READ_ERROR__:{exc}"


def iter_files(path: Path, suffix: str | None = None) -> Iterable[Path]:
    for item in sorted(path.rglob("*")):
        if item.is_file() and (suffix is None or item.name.lower().endswith(suffix.lower())):
            yield item


def audit_readme_case(base: Path, root: Path, typ: str, findings: list[Finding]) -> None:
    for file in iter_files(base):
        if file.name.lower() == "readme.md" and file.name != "README.md":
            add(
                findings,
                "ERROR",
                typ,
                rel(file, root),
                "说明文件应当严格命名为 README.md（大小写敏感）",
                f"说明文件名为 `{file.name}`，大小写不符合规范。",
                "将文件重命名为 `README.md`。",
            )


def audit_combat(combat: Path, root: Path, findings: list[Finding]) -> dict[str, int]:
    files = list(iter_files(combat, ".txt"))
    for file in files:
        rpath = rel(file, root)
        stem = file.stem
        content = read_text(file)
        lines = content.splitlines()
        author_lines = [line for line in lines if "作者" in line and line.lstrip().startswith("//")]
        exact_author_lines = [line for line in lines if COMBAT_AUTHOR_EXACT.match(line)]
        if not exact_author_lines:
            if author_lines:
                loose = [line for line in author_lines if COMBAT_AUTHOR_LOOSE.match(line)]
                severity = "ERROR" if loose else "WARNING"
                add(
                    findings,
                    severity,
                    "combat",
                    rpath,
                    "战斗策略署名必须使用 `//作者：你的名字`",
                    "未找到严格格式署名；检测到疑似署名：" + "；".join(f"`{x}`" for x in author_lines[:3]),
                    "改为无空格、中文冒号的格式，例如 `//作者：你的名字`。",
                )
            else:
                add(
                    findings,
                    "ERROR",
                    "combat",
                    rpath,
                    "战斗策略署名必须使用 `//作者：你的名字`",
                    "未找到作者署名注释。",
                    "在文件头部添加 `//作者：你的名字`。",
                )
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("/*") or stripped.startswith("*"):
                add(
                    findings,
                    "ERROR",
                    "combat",
                    rpath,
                    "战斗策略脚本中使用 `//` 进行注释",
                    f"检测到非 `//` 注释样式：`{stripped[:80]}`。",
                    "将注释改写为 `//` 开头。",
                )
                break
        if "副本" in content and "锄地" not in content and not stem.endswith("-副本"):
            add(
                findings,
                "MANUAL_REVIEW",
                "combat",
                rpath,
                "只能用于副本、不适用于锄地的战斗策略应增加 `-副本` 后缀",
                "脚本文本提到副本且未提到锄地，但文件名没有 `-副本` 后缀；是否只能用于副本需要人工确认。",
                "若只能用于副本，请将文件名改为 `...-副本.txt`；否则在注释中明确适用范围。",
            )
        if "不适用于锄地" in content and not stem.endswith("-副本"):
            only_domain = "只能用于副本" in content or "仅用于副本" in content
            add(
                findings,
                "ERROR" if only_domain else "MANUAL_REVIEW",
                "combat",
                rpath,
                "只有同时满足“只能用于副本、不适用于锄地”的战斗策略才应增加 `-副本` 后缀",
                "脚本写有“不适用于锄地”，但未能自动确认是否只能用于副本；好感/盗宝团等特殊用途需要人工判断。",
                "人工确认适用场景；若只能用于副本，请将文件名增加 `-副本` 后缀，否则在注释中明确特殊用途。",
                None if only_domain else "ERROR",
            )
        # Character abbreviations are partly semantic. Flag filenames without obvious Chinese character sequences used in action lines.
        action_chars = set()
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("//"):
                continue
            m = re.match(r"([\u4e00-\u9fff]{1,4})\s", stripped)
            if m:
                action_chars.add(m.group(1)[0])
        if action_chars and not any(ch in stem for ch in action_chars):
            add(
                findings,
                "MANUAL_REVIEW",
                "combat",
                rpath,
                "脚本名称应包含使用的角色简写",
                "文件名未明显包含动作行中角色名称的首字。角色简写判定存在语义性，需人工复核。",
                "确认文件名是否包含主要角色简写；如没有，请按队伍角色补充。",
            )
    return {"combat_files": len(files)}


def material_dir_for(path: Path, pathing: Path) -> str | None:
    """Infer the material/monster directory only for categories with stable layouts."""
    parts = path.relative_to(pathing).parts
    if len(parts) < 2:
        return None
    category = parts[0]
    if category in {"矿物", "敌人与魔物", "食材与炼金"}:
        return parts[1]
    if category == "地方特产" and len(parts) >= 3:
        return parts[2]
    return None


def pathing_special_case(parts: tuple[str, ...]) -> str | None:
    if len(parts) >= 2 and parts[0] == "其他" and parts[1] == "成就":
        return "其他/成就"
    if len(parts) >= 2 and parts[0] == "其他" and parts[1] == "提瓦特钓鱼指南":
        return "其他/提瓦特钓鱼指南"
    if parts and parts[0] == "其他":
        return "其他"
    return None


def audit_pathing(pathing: Path, root: Path, findings: list[Finding]) -> dict[str, int]:
    audit_readme_case(pathing, root, "pathing", findings)
    json_files = list(iter_files(pathing, ".json"))
    readmes = [p for p in iter_files(pathing) if p.name == "README.md"]
    special_counts = {"其他/成就": 0, "其他/提瓦特钓鱼指南": 0, "其他": 0}

    for category_dir in sorted(p for p in pathing.iterdir() if p.is_dir()):
        if category_dir.name == "食材与炼金":
            add(
                findings,
                "WARNING",
                "pathing",
                rel(category_dir, root),
                "README category list may be inconsistent with existing repo/pathing/食材与炼金",
                "README 明列的一級分類未包含 `食材与炼金`，但仓库中存在该一级目录；不再对该目录下每个文件重复报一級分類 ERROR。",
                "维护者应确认 README 是否需要补充该分类，或规划迁移该目录。",
                "ERROR",
            )
        elif category_dir.name not in README_PATHING_CATEGORIES:
            add(
                findings,
                "ERROR",
                "pathing",
                rel(category_dir, root),
                README_LISTED_CATEGORY_RULE,
                f"一级分类 `{category_dir.name}` 不在 README 显式列出的分类中。",
                "移动到 README 规定分类，或先更新 README 分类规范后再使用该分类。",
            )

    for directory in sorted(p for p in pathing.rglob("*") if p.is_dir()):
        children = list(directory.iterdir())
        has_json = any(c.is_file() and c.suffix.lower() == ".json" for c in children)
        has_dir = any(c.is_dir() for c in children)
        if has_json and has_dir:
            add(
                findings,
                "ERROR",
                "pathing",
                rel(directory, root),
                "不应存在 JSON 文件和子目录同级混放",
                "同一目录下同时存在地图追踪 JSON 文件和子目录。",
                "将 JSON 文件移动到专门子目录，或调整子目录层级。",
            )

    for file in json_files:
        rpath = rel(file, root)
        stem = file.stem
        parts = file.relative_to(pathing).parts
        special_case = pathing_special_case(parts)
        if special_case:
            special_counts[special_case] = special_counts.get(special_case, 0) + 1
            add(
                findings,
                "MANUAL_REVIEW",
                "pathing",
                rpath,
                "legacy/pathing-special-case exclusions",
                f"`repo/pathing/{special_case}` 属于特殊用途或非标准材料采集路径；已跳过编号、数量、材料目录一致性的 hard fail。",
                "人工确认该路径是否需要独立命名规范；如属于材料采集路线，再按标准命名补齐编号、材料名和数量。",
                "ERROR",
            )
        material = None if special_case else material_dir_for(file, pathing)
        if not special_case and material is None:
            add(
                findings,
                "MANUAL_REVIEW",
                "pathing",
                rpath,
                "无法可靠推断材料目录时不应 hard fail 材料名称一致性",
                "该文件所在分类/层级无法可靠推断材料或怪物名称。",
                "人工确认目录层级；若属于标准分类，请移动到 README 规定的材料/怪物目录结构。",
                "ERROR",
            )

        # For legacy repositories, filename convention drift is reported as WARNING rather than ERROR.
        if not special_case:
            if not PATHING_NUMBER_PREFIX.search(stem):
                add(
                    findings,
                    "WARNING",
                    "pathing",
                    rpath,
                    "地图追踪脚本文件名应以两位/三位编号开头，例如 `01-材料-地点-6个`",
                    "文件名未以规范编号和连字符开头。",
                    "按 `编号-材料名称-区域/地点-数量` 重命名；历史路线可批量规划后再迁移。",
                    "ERROR",
                )
            if material and material.split("@")[0] not in stem:
                add(
                    findings,
                    "WARNING",
                    "pathing",
                    rpath,
                    "文件名材料名称应与所在材料目录一致",
                    f"所在材料目录推断为 `{material}`，但文件名 `{stem}` 未包含该材料名称。",
                    "将文件名中的材料名称改为材料目录名，或移动到正确材料目录；如目录为兼容历史结构，请人工确认。",
                    "ERROR",
                )
            if not PATHING_QUANTITY.search(stem):
                add(
                    findings,
                    "WARNING",
                    "pathing",
                    rpath,
                    "地图追踪脚本文件名应包含预期采集数量，例如 `6个`、`1只`、`3朵`",
                    "文件名未包含合法数量信息；支持 `个`、`只`、`朵`、`条`、`株` 以及范围数量。",
                    "在文件名末尾补充预期数量，例如 `-6个` 或 `-1只`；历史路线可先列入迁移计划。",
                    "ERROR",
                )
            extra_chars = set("_()（）[]【】,.，、@")
            if any(ch in stem for ch in extra_chars):
                add(
                    findings,
                    "WARNING",
                    "pathing",
                    rpath,
                    "脚本名称原则上仅限编号、材料名称、区域/子区域、数量，不应包含额外描述或标点",
                    "文件名包含可能属于额外描述或标点的字符。",
                    "确认是否必要；如非必要，按 README 示例精简命名。",
                )
        try:
            data = json.loads(file.read_text(encoding="utf-8-sig"))
        except Exception as exc:
            add(findings, "ERROR", "pathing", rpath, "地图追踪 JSON 应可被解析", f"JSON 解析失败：{exc}", "修复 JSON 语法/编码。")
            continue
        json_name = None
        if isinstance(data, dict):
            info = data.get("info")
            if isinstance(info, dict):
                json_name = info.get("name")
            if json_name is None:
                json_name = data.get("name")
        if json_name != stem:
            add(
                findings,
                "ERROR",
                "pathing",
                rpath,
                "脚本文件名应当和 JSON 中的 `info.name` 或 `name` 字段相同",
                f"JSON 名称为 `{json_name}`，文件名为 `{stem}`。",
                "将 JSON 的 `info.name`/`name` 改为文件名，或重命名文件。",
            )
    return {
        "pathing_json_files": len(json_files),
        "pathing_readmes": len(readmes),
        "pathing_special_achievement": special_counts.get("其他/成就", 0),
        "pathing_special_fishing": special_counts.get("其他/提瓦特钓鱼指南", 0),
        "pathing_special_other": special_counts.get("其他", 0),
    }

def audit_js(js: Path, root: Path, findings: list[Finding]) -> dict[str, int]:
    audit_readme_case(js, root, "js", findings)
    script_dirs = sorted(p for p in js.iterdir() if p.is_dir())
    for script in script_dirs:
        rpath = rel(script, root)
        if " " in script.name:
            add(findings, "ERROR", "js", rpath, "JS 脚本主体文件夹名称不应包含空格", "文件夹名称包含空格。", "删除空格或使用大驼峰式命名。")
        if re.search(r"[_\-&]", script.name) or re.match(r"^[a-z0-9]", script.name):
            add(
                findings,
                "WARNING",
                "js",
                rpath,
                "JS 主体文件夹名称可采用大驼峰式命名法等；README 未绝对禁止 `_`、`-`、`&`、数字/小写开头",
                "文件夹名称存在非典型大驼峰命名特征。",
                "人工确认名称是否清晰；如需规范化，改为大驼峰式命名。",
            )
        for required in ("manifest.json", "main.js"):
            if not (script / required).is_file():
                add(findings, "ERROR", "js", rpath, f"每个 `repo/js/<scriptName>` 应包含 `{required}`", f"缺少 `{required}`。", f"补充 `{required}`，或移除/归档非 JS 脚本目录。")
        readme = script / "README.md"
        readme_text = read_text(readme) if readme.is_file() else ""
        resource_files: list[Path] = []
        for child in script.iterdir():
            if child.is_dir() and child.name.lower() in RESOURCE_DIR_NAMES:
                resource_files.extend([p for p in child.rglob("*") if p.is_file() and p.name != "README.md"])
        if resource_files and not readme.is_file():
            add(findings, "ERROR", "js", rpath, "脚本使用的资源文件应在 README.md 中注明实际用途", "存在资源目录但缺少 README.md。", "添加 README.md 并说明资源文件用途。")
        elif resource_files:
            missing_mentions = []
            for asset in resource_files:
                name = asset.name
                stem = asset.stem
                asset_rel = asset.relative_to(script).as_posix()
                if name not in readme_text and stem not in readme_text and asset_rel not in readme_text:
                    missing_mentions.append(asset_rel)
            if missing_mentions:
                shown = ", ".join(missing_mentions[:8])
                suffix = " ..." if len(missing_mentions) > 8 else ""
                add(
                    findings,
                    "WARNING",
                    "js",
                    rpath,
                    "脚本使用的资源文件应在 README.md 中注明实际用途",
                    f"资源文件未在 README 中按文件名/相对路径明显提及：{shown}{suffix}",
                    "在 README.md 中补充这些资源文件或资源目录的用途说明。",
                )
    return {"js_script_dirs": len(script_dirs)}


def make_report(root: Path, stats: dict[str, int], findings: list[Finding]) -> str:
    now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts = {severity: sum(1 for f in findings if f.severity == severity) for severity in SEVERITIES}
    affected_paths = {f.path for f in findings}
    downgraded_count = sum(1 for f in findings if f.downgraded_from)
    rule_counts: dict[tuple[str, str], int] = {}
    for finding in findings:
        key = (finding.severity, finding.rule)
        rule_counts[key] = rule_counts.get(key, 0) + 1
    repository_issues = [
        f for f in findings
        if f.rule.startswith("README category list may") or f.path in {"<repository>", "repo/pathing", "repo/js", "repo/combat"}
    ]
    lines = [
        "# Script Spec Audit Report",
        "",
        f"- 扫描时间：`{now}`",
        "- 扫描范围：`repo/combat`、`repo/pathing`、`repo/js`",
        "- 依据：仓库 README 的「脚本提交规范」；已确认 `build/build.js` 主要负责生成/更新 `repo.json`，`build/validate.py` 主要覆盖地图追踪 JSON 结构、字段、版本、作者、编码及 JSON/子目录混放校验，本工具补充命名与打包规范审计。",
        "- Severity 说明：历史/特殊用途 pathing 的命名漂移默认不再 hard fail；只有可明确自动判定的结构或元数据不一致保留为 ERROR。",
        "",
        "## 扫描数量统计",
        "",
        "| Scope | Count |",
        "| ----- | -----: |",
        f"| combat `.txt` files | {stats.get('combat_files', 0)} |",
        f"| pathing `.json` files | {stats.get('pathing_json_files', 0)} |",
        f"| pathing `README.md` files | {stats.get('pathing_readmes', 0)} |",
        f"| js script directories | {stats.get('js_script_dirs', 0)} |",
        "",
        "## Findings Summary",
        "",
        "| Metric | Count |",
        "| ------ | ----: |",
        f"| ERROR | {counts['ERROR']} |",
        f"| WARNING | {counts['WARNING']} |",
        f"| MANUAL_REVIEW | {counts['MANUAL_REVIEW']} |",
        f"| TOTAL findings | {len(findings)} |",
        f"| affected files/paths count | {len(affected_paths)} |",
        f"| downgraded count | {downgraded_count} |",
        "",
        "## Repository-level Issues",
        "",
        "| Severity | Path | Rule | Problem | Suggested Fix |",
        "| -------- | ---- | ---- | ------- | ------------- |",
    ]
    if repository_issues:
        for f in repository_issues:
            lines.append(
                f"| {md_escape(f.severity)} | `{md_escape(f.path)}` | {md_escape(f.rule)} | {md_escape(f.problem)} | {md_escape(f.suggested_fix)} |"
            )
    else:
        lines.append("| - | - | - | 未发现 repository-level issue。 | - |")
    lines.extend([
        "",
        "## Legacy / Pathing Special-case Exclusions",
        "",
        "这些路径不会直接套用标准材料采集命名 hard fail；对应文件会进入 WARNING 或 MANUAL_REVIEW，供维护者确认是否需要单独规范。",
        "",
        "| Exclusion | Affected JSON Files | Handling |",
        "| --------- | ------------------: | -------- |",
        f"| `repo/pathing/其他/成就/**` | {stats.get('pathing_special_achievement', 0)} | 跳过编号、数量、材料目录一致性 ERROR，列为 MANUAL_REVIEW。 |",
        f"| `repo/pathing/其他/提瓦特钓鱼指南/**` | {stats.get('pathing_special_fishing', 0)} | 釣魚特殊用途，不 hard fail 数量/材料目录一致性，列为 MANUAL_REVIEW。 |",
        f"| other `repo/pathing/其他/**` | {stats.get('pathing_special_other', 0)} | 通常无法可靠推断材料目录，列为 MANUAL_REVIEW。 |",
        "",
        "## Rule-level Count",
        "",
        "| Severity | Rule | Count |",
        "| -------- | ---- | ----: |",
    ])
    for (severity, rule), count in sorted(rule_counts.items(), key=lambda item: (SEVERITIES.index(item[0][0]), item[0][1])):
        lines.append(f"| {md_escape(severity)} | {md_escape(rule)} | {count} |")
    lines.extend([
        "",
        "## Detailed Findings",
        "",
        "| Severity | Type | Path | Rule | Problem | Suggested Fix |",
        "| -------- | ---- | ---- | ---- | ------- | ------------- |",
    ])
    for f in sorted(findings, key=lambda x: (SEVERITIES.index(x.severity), x.type, x.path, x.rule)):
        lines.append(
            f"| {md_escape(f.severity)} | {md_escape(f.type)} | `{md_escape(f.path)}` | {md_escape(f.rule)} | {md_escape(f.problem)} | {md_escape(f.suggested_fix)} |"
        )
    if not findings:
        lines.append("| - | - | - | - | 未发现问题。 | - |")
    lines.append("")
    return "\n".join(lines)

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit README script submission conventions.")
    parser.add_argument("root", help="repository root")
    parser.add_argument("--report", default="docs/SCRIPT_SPEC_AUDIT_REPORT.md", help="Markdown report output path")
    parser.add_argument("--fail-on-errors", action="store_true", help="exit non-zero when ERROR findings exist")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    combat, pathing, js = require_scopes(root)
    findings: list[Finding] = []
    stats: dict[str, int] = {}
    stats.update(audit_combat(combat, root, findings))
    stats.update(audit_pathing(pathing, root, findings))
    stats.update(audit_js(js, root, findings))

    report = make_report(root, stats, findings)
    report_path = (root / args.report).resolve() if not Path(args.report).is_absolute() else Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8")

    counts = {severity: sum(1 for f in findings if f.severity == severity) for severity in SEVERITIES}
    print(f"Wrote {report_path}")
    print(f"Scanned: combat={stats.get('combat_files', 0)}, pathing_json={stats.get('pathing_json_files', 0)}, js_dirs={stats.get('js_script_dirs', 0)}")
    print(f"Findings: ERROR={counts['ERROR']}, WARNING={counts['WARNING']}, MANUAL_REVIEW={counts['MANUAL_REVIEW']}")
    if args.fail_on_errors and counts["ERROR"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
