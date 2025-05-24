(async function () {
    // 自动领取每日委托&探索派遣奖励
    await genshin.goToAdventurersGuild("枫丹");
    await sleep(1000);
    click(960,300);
    await sleep(1000);
    click(960,300);
    await sleep(1000);
    await genshin.returnMainUi();
    // Again
    await genshin.goToAdventurersGuild("枫丹");
    await sleep(1000);
    click(960,300);
    await sleep(1000);
    click(960,300);
    await sleep(1000);
    await genshin.returnMainUi();
    // 自动领取纪行奖励
    await genshin.claimBattlePassRewards();
    await genshin.returnMainUi();
})();