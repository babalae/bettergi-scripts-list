// BetterGI uses eval rather than CommonJS. Keep this entrypoint deliberately thin.
for (const name of ["core", "strategy", "bgi", "player"]) {
  eval(file.readTextSync("lib/" + name + ".js"));
}

(async function () {
  "use strict";
  const options = TCG.playerOptions(typeof settings === "undefined" ? {} : settings);
  setGameMetrics(1920, 1080);
  const host = new TCGBetterGI.BetterGIHost(options);
  await new TCG.Player(host, options).run();
})();
