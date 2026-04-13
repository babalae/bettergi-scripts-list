const fs = require("fs");
const path = require("path");

function splitCsvLine(line) {
  // Basic CSV split on commas (no quoted fields in source file).
  return line.split(",");
}

function csvToJson(csvText) {
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0].trim();
  if (!headerLine) {
    return [];
  }

  const headers = splitCsvLine(headerLine);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.trim()) {
      continue;
    }

    const values = splitCsvLine(line);
    const hasAnyValue = values.some((value) => value && value.trim() !== "");
    if (!hasAnyValue) {
      continue;
    }
    const row = {};

    for (let h = 0; h < headers.length; h += 1) {
      const key = headers[h];
      row[key] = values[h] !== undefined ? values[h] : "";
    }

    rows.push(row);
  }

  return rows;
}

function run() {
  const inputPath = process.argv[2] || "千星奇域-猜角色辅助-工作表1.csv";
  const outputPath = process.argv[3] || "data.json";

  const csvText = fs.readFileSync(path.resolve(inputPath), "utf8");
  const data = csvToJson(csvText);
  fs.writeFileSync(
    path.resolve(outputPath),
    JSON.stringify(data, null, 2),
    "utf8"
  );

  console.log(`Wrote ${data.length} rows to ${outputPath}`);
}

run();
