for (const name of ["core","strategy","bgi","player","collapsed-hand","opening-hand","hand-recognition"]) {
  eval(file.readTextSync("lib/" + name + ".js"));
}
(async function () {
  "use strict";
  const options = TCGPlayer.playerOptions(typeof settings === "undefined" ? {} : settings);
  const {Host, Player} = TCGHandRecognition.classes(globalThis, JSON.parse(file.readTextSync("hand-bank.json")), JSON.parse(file.readTextSync("opening-bank.json")));
  return new Player(new Host(options), options).run();
})();
