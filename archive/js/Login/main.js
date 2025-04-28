(async function () {
    //特殊字符键盘映射集
    const map = {
        '(': '9',
        ')': '0',
        '`': 'VK_OEM_3',
        '!': '1',
        '@': '2',
        '#': '3',
        '$': '4',
        '%': '5',
        '^': '6',
        '&': '7',
        '*': '8',
        '_': 'VK_SUBTRACT',
        '-': 'VK_SUBTRACT',
        '+': 'VK_ADD',
        '=': 'VK_ADD',
        '|': 'VK_SEPARATOR',
        '{': 'VK_OEM_4',
        '}': 'VK_OEM_6',
        '[': 'VK_OEM_4',
        ']': 'VK_OEM_6',
        ':': 'VK_OEM_1',
        ';': 'VK_OEM_1',
        '\'': 'VK_OEM_7',
        '"': 'VK_OEM_7',
        '<': 'VK_OEM_COMMA',
        '>': 'VK_OEM_PERIOD',
        ',': 'VK_OEM_COMMA',
        '.': 'VK_OEM_PERIOD',
        '?': 'VK_OEM_2',
    };
    function replaceUsingMap(input) {
        return map[input] || input;  // 如果找到映射，返回对应的值；否则返回原值
    }
    setGameMetrics(1920, 1080, 2);
    await sleep(3000);
    //同意用户协议
    click(698, 610);
    await sleep(1000);
    //点击用户名输入框
    click(800, 400);
    await sleep(1000);
    //输入用户名
    log.info("输入用户名");
    let username = settings.username;
    let usernameList = username.split('');
    usernameList.forEach(element => {
        charCode = element.charCodeAt(0);
        let arr = [40,41,33,64,35,36,37,94,38,42,95,43,124,123,125,58,34,60,62,63];
        if(charCode > 64 && charCode < 91 || arr.includes(charCode)==1){
            element=replaceUsingMap(element);
            keyDown("SHIFT");
            keyPress(element);
            keyUp("SHIFT");
        }else{
            element=replaceUsingMap(element);
            keyPress(element);
        }
    });
    log.info("用户名={xx}",username)
    await sleep(3000);
    //点击用户名输入框
    click(800, 500);
    await sleep(1000);
    //输入密码
    log.info("输入密码")
    let password = settings.password;
    let passwordList = password.split('');
    passwordList.forEach(element => {
        charCode = element.charCodeAt(0);
        let arr = [40,41,33,64,35,36,37,94,38,42,95,43,124,123,125,58,34,60,62,63];
        if(charCode > 64 && charCode < 91 || arr.includes(charCode)==1){
            element=replaceUsingMap(element);
            keyDown("SHIFT");
            keyPress(element);
            keyUp("SHIFT");
        }else{
            element=replaceUsingMap(element);
            keyPress(element);
        }
    });
    log.info("密码={xx}",password);
    await sleep(1000);
    //登录
    keyPress("RETURN");
    await sleep(10000);
    //进入世界
    click(950, 1000);
    log.info("进入世界");
    await sleep(10000);
    //进入世界2
    click(950, 1000);
    log.info("进入世界2");
    await sleep(10000);
    //点击领月卡
    click(950, 1000);
    log.info("点击领月卡");
    await sleep(1000);
    //点击领月卡2
    click(950, 1000);
    log.info("点击领月卡2");
    await sleep(1000);
    //点击领月卡2
    click(950, 1000);
    log.info("点击领月卡3");
    await sleep(1000);
})();