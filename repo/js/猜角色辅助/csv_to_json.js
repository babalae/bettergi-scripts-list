const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = "千星奇域-猜角色辅助-工作表1.csv";
const DEFAULT_OUTPUT = "data.json";

const SERIES_GROUPS = [
  { prefix: "元素战技台词", section: "台词", key: "元素战技" },
  { prefix: "元素爆发台词", section: "台词", key: "元素爆发" },
  { prefix: "入队语音", section: "台词", key: "入队语音" },
  { prefix: "倒下语音", section: "台词", key: "倒下语音" },
  { prefix: "宝箱语音", section: "台词", key: "宝箱语音" },
  { prefix: "命之座", key: "命之座" },
  { prefix: "天赋", key: "天赋" }
];
SERIES_GROUPS.forEach((group, index) => {
  group.index = index;
});

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        value += "\"";
        i += 1;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (ch !== "\r") {
      value += ch;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return String(header || "").replace(/^\uFEFF/, "").trim();
}

function findSeriesGroup(key) {
  return SERIES_GROUPS.find((group) => {
    if (key === group.prefix) {
      return true;
    }
    const re = new RegExp(`^${escapeRegExp(group.prefix)}\\d+$`);
    return re.test(key);
  });
}

function isSeriesKey(key) {
  return !!findSeriesGroup(key);
}

function splitMultiValue(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/[\n\u2028\u2029]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function putSeriesValue(target, group, value) {
  if (!value) {
    return;
  }
  if (group.section) {
    if (!target[group.section]) {
      target[group.section] = {};
    }
    if (!target[group.section][group.key]) {
      target[group.section][group.key] = [];
    }
    target[group.section][group.key].push(value);
    return;
  }
  if (!target[group.key]) {
    target[group.key] = [];
  }
  target[group.key].push(value);
}

function transformRow(rawRow) {
  const item = {};
  const info = {};
  const seriesValues = [];

  for (const [key, value] of Object.entries(rawRow)) {
    const cleanedValue = String(value || "").trim();
    const group = findSeriesGroup(key);

    if (group) {
      const numbered = key !== group.prefix;
      const order = numbered ? Number(key.match(/\d+$/)[0]) : 0;
      const values = numbered ? [cleanedValue] : splitMultiValue(cleanedValue);
      seriesValues.push({ group, order, values });
    } else if (!isSeriesKey(key)) {
      info[key] = cleanedValue;
    }
  }

  const name = info["角色名"] || "";
  item["角色名"] = name;
  item["信息"] = info;

  seriesValues
    .sort((a, b) => a.group.index - b.group.index || a.order - b.order)
    .forEach(({ group, values }) => {
      values.forEach((value) => putSeriesValue(item, group, value));
    });

  return item;
}

function csvToJson(csvText) {
  const table = parseCsv(csvText);
  if (table.length === 0) {
    return [];
  }

  const headers = table[0].map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < table.length; i += 1) {
    const values = table[i];
    const hasAnyValue = values.some((value) => value && value.trim() !== "");
    if (!hasAnyValue) {
      continue;
    }

    const rawRow = {};
    for (let h = 0; h < headers.length; h += 1) {
      const key = headers[h];
      if (!key) {
        continue;
      }
      rawRow[key] = values[h] !== undefined ? values[h] : "";
    }

    rows.push(transformRow(rawRow));
  }

  return rows;
}

function run() {
  const inputPath = process.argv[2] || DEFAULT_INPUT;
  const outputPath = process.argv[3] || DEFAULT_OUTPUT;

  const csvText = fs.readFileSync(path.resolve(inputPath), "utf8");
  const data = csvToJson(csvText);
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(data, null, 2), "utf8");

  console.log(`Wrote ${data.length} rows to ${outputPath}`);
}

run();
