eval(file.readTextSync('lib/core.js'));

(async function main() {
    try {
        await sleep(2000);
        await Core.executeSingleProcess();
        await Core.executeMainProcess();
        await Core.executeMainProcess1();

        
    } catch (err) {
        log.error(`服务崩溃: ${err.message}`);
    }
})();
