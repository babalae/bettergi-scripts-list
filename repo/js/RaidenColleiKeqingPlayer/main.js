eval(file.readTextSync("lib/core.js"));
eval(file.readTextSync("lib/strategy.js"));
eval(file.readTextSync("lib/bgi.js"));
eval(file.readTextSync("lib/player.js"));

(async function () {
  "use strict";
  const options = TCGPlayer.playerOptions(settings);
  setGameMetrics(1920, 1080);
  const host = new TCGBetterGI.BetterGIHost(options);
  return new TCGPlayer.Player(host, options).run();
})();
