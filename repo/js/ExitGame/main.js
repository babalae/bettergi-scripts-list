(async function () {
    // settings 的对象内容来自于 settings.json 文件生成的动态配置页面
//前置系统状态：大世界正常主界面
	setGameMetrics(3840,2160,2)
        keyPress("VK_ESCAPE");//打开派蒙菜单
        await sleep(1000);
	click(90,2000);//点击左下角退出按钮
	await sleep(1000);
	click(2100,1500);//点击确定
	await sleep(10000);//渲染开门界面的时间
	click(200,1950);//点击登录界面左下角退出按钮
	await sleep(1000);
	click(2200,1100);//点击确定
	await sleep(1000);
})();