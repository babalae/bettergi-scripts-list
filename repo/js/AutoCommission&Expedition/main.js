(async function () {
    // 自动每日或纪行
    await genshin.goToAdventurersGuild("枫丹");
    await keyPress("F");
    dispatcher.addTimer(new RealtimeTimer("AutoSkip", { "forceInteraction": true }));
})();