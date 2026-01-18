(async function () {
    const hour = Number(settings.hour || "6");
    const minute = Number(settings.minute || "0");
    const skip = settings.skip;
    setGameMetrics(1920, 1080, 1);
    await genshin.returnMainUi();
    await genshin.setTime(hour, minute, skip);
})();