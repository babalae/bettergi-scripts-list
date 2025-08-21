(
    async function () {
        const codes = [
            "NODKRAI0910",
            "VOYNICHGUILD",
            "THEWILDHUNT",
            "LIGHTKEEPERS",
            "FROSTMOONSCIONS"
        ];
        //输入兑换码，兑换码与兑换码之间要以英文逗号隔开，如: "123","123",兑换码要用""框起
        await sleep(3000);
        keyPress("VK_ESCAPE");
        await sleep(1000);
        click(55,793);
        await sleep(1000);
        click(162,569);
        await sleep(1000);
        click(1649,210);
        await sleep(1000);
        keyDown("VK_LSHIFT");
        keyUp("VK_LSHIFT");
        for (const code of codes){
            click(734,506);
            await sleep(1000);
            for(const cod of code){
                keyPress("VK_"+cod);
        }
        //keyUp("VK_LSHIFT");
        await sleep(1000);
        click(1164,735);
        await sleep(1000);
        click(991,744);
        await sleep(5500);
    }
}
)();