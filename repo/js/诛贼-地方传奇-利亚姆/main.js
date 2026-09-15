eval(file.readTextSync('lib/core.js'));

(async function main() {
    try {
        await sleep(2000);
        await Core.executeSingleProcess();

        
    } catch (err) {
        log.error(`服务崩溃: ${err.message}`);
    }
})();
