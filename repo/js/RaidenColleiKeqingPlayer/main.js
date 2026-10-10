// Standalone BetterGI entry: no sibling-script or development dependency.
for (const name of ["core", "strategy", "bgi", "player"]) {
  eval(file.readTextSync("lib/" + name + ".js"));
}
(async function () {
  "use strict";
  const options = TCGPlayer.playerOptions(typeof settings === "undefined" ? {} : settings);
  setGameMetrics(1920, 1080);
  return new TCGPlayer.Player(new TCGBetterGI.BetterGIHost(options), options).run();
})();
