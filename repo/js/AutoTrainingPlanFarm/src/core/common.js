// 通用工具：设置读取、名称清洗、缩放坐标、看门狗、编辑距离

export let scaleX = 1;
export let scaleY = 1;

// 8 秒无操作看门狗
let lastActivity = Date.now();

export function setMetrics(w, h) {
  scaleX = w / 1920;
  scaleY = h / 1080;
}

// 所有 1920x1080 参考坐标按实际截图尺寸缩放
export function sX(v) { return Math.round(v * scaleX); }
export function sY(v) { return Math.round(v * scaleY); }

export function touchActivity() {
  lastActivity = Date.now();
}

export function assertAlive() {
  if (Date.now() - lastActivity > 8000) {
    throw new Error("8 秒无操作，超时退出");
  }
}

export function parkMouse() {
  try {
    const [gw, gh] = getGameMetrics();
    moveMouseTo(Math.round(gw / 2), Math.round(gh / 6));
  } catch (e) { }
}

export function canonicalName(name) {
  return String(name || "").replace(/[「」『』\[\]（）()]/g, "").trim();
}

export function getS(name, def) {
  const v = settings ? settings[name] : undefined;
  return v === undefined || v === null ? def : v;
}

export function levDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) dp.push(new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}
