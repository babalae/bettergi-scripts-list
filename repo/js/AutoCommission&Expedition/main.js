(async function () {
    // 自动领取每日委托奖励&探索派遣
    await genshin.goToAdventurersGuild("枫丹");
    await sleep(1000);
    click(960,1000);
    await sleep(1000);
    click(960,1000);
    await sleep(1000);
    // Again
    await genshin.goToAdventurersGuild("枫丹");
    await sleep(1000);
    click(960,1000);
    await sleep(1000);
    click(960,1000);
    await sleep(1000);
    await keyPress("F");
    dispatcher.addTimer(new RealtimeTimer("AutoSkip", { "forceInteraction": true }));
    // 自动领取纪行奖励
    await genshin.claimBattlePassRewards();
})();