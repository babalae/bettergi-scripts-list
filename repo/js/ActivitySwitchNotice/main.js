eval(file.readTextSync(`utils/activity.js`))

(async function () {
    await main();
})();
/**
 * @returns {Promise<void>}
 */
async function main(){
    await activityUtil.activityMain()
}