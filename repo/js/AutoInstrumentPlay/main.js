
(async function () {
    // 读取配置
    let music_name = ((settings.music_name !== undefined) && (settings.music_name !== "")) ? (`assets/${settings.music_name}.json`) : (undefined);
    if (music_name === undefined) { log.info("乐谱名称未指定"); return; }
    let auto_gadget = (settings.auto_gadget !== undefined) ? (settings.auto_gadget) : ("不自动使用");
    /**
     * --------工具函数--------
     */
    const gadget_key = "VK_Z";
    const key_1 = "VK_1";
    const key_2 = "VK_2";
    const key_3 = "VK_3";
    const key_4 = "VK_4";
    /**
     * 自动进入乐器演奏
     */
    async function use_gadget(use_type) {
        if (use_type === "不自动使用") return;
        keyDown(gadget_key);
        await sleep(2000);
        keyUp(gadget_key);
        switch (use_type) {
            case "一号位小道具": keyPress(key_1); break;
            case "二号位小道具": keyPress(key_2); break;
            case "三号位小道具": keyPress(key_3); break;
            case "四号位小道具": keyPress(key_4); break;
            default: break;
        }
        await sleep(1000);
        keyPress(gadget_key);
    }
    test_word = "12345676";
    /**
     * 解析乐谱
     */
    async function read_sheet_music(file_path) {
        try {
            let json_file = JSON.parse(file.readTextSync(file_path));
            return json_file;
        } catch (error) {
            log.error(`解析乐谱失败: ${error}`);
        }
    }

    /**
     * 乐谱序列化
     * 规则1：遇到"/"，将其跳过
     * 规则2：使用()包裹的A-Z字母视作一组，没有使用()包裹的每个字母单独视作一组
     * 规则3：遇到空格或-视作往左最近的一组字母，占位但不视做新组
     * 规则4：遇到新的一组字母时，向队列中添加一个列表，内容为[此组字母在字符串中的组数,[左侧的一组字母],[新的一组字母]]
     * 规则5：在字符串完成遍历后，添加[当前已遍历的组数+1,[最后的一组字母],[此处为空列表]]
     * 规则6：组数不是简单的索引，而是基于以上规则对字符串进行修改分割后的序号，可以使用从1开始的计数器，在遍历到一组结束后自增1
     * 
     * @param {String} music 
     * @returns 
     */
    function music_analyse(music) {
        let currentGroup = [];
        let inParentheses = false;
        let groupCount = 0;
        let lastNonSpaceGroup = [];
        let result = [];

        for (let i = 0; i < music.length; i++) {
            let char = music[i];
            // 规则1：跳过"/"
            if (char === '/') continue;
            // 规则2，()处理
            if (char === '(') {
                inParentheses = true;
                currentGroup = [];
                continue;
            }
            if (char === ')') {
                inParentheses = false;
                if (currentGroup.length > 0) {
                    groupCount++;
                    result.push([groupCount, lastNonSpaceGroup, currentGroup]);
                    lastNonSpaceGroup = currentGroup;
                }
                currentGroup = [];
                continue;
            }
            // 规则3：空格或-视作左最近的一组字母，占位但不视作新组
            if (char === ' ' || char === '-') {
                groupCount++;
                continue;
            }
            /**
             * --------上方为短路计算--------
             */

            // 规则2：括号内的字母添加到当前组
            if (inParentheses) {
                if (char >= 'A' && char <= 'Z') {
                    currentGroup.push(char);
                }
            } else {
                // 非括号字母，单独成组
                groupCount++;
                result.push([groupCount, lastNonSpaceGroup, [char]]);
                lastNonSpaceGroup = [char];
            }
        }

        // 规则5：添加结束标记
        result.push([groupCount + 1, lastNonSpaceGroup, []]);

        return result;
    }
    /**
     * 乐谱演奏
     * @param {Array} keyList 
     * @param {Number} gap 
     */
    async function play_music(keyList, gap) {
        let counter = 0;
        let currentPressedKeys = new Set(); // 跟踪当前按下的按键
        while (keyList.length > 0) {
            // 检查计数器是否达到当前组的组数
            if (counter >= keyList[0][0]) {
                const [groupNum, upKeys, downKeys] = keyList[0];

                // 计算需要释放的按键（在当前按下但不在新组中的按键）
                const keysToRelease = [...currentPressedKeys].filter(
                    key => !downKeys.includes(key)
                );
                // 计算需要按下的按键（在新组中但当前未按下的按键）
                const keysToPress = downKeys.filter(
                    key => !currentPressedKeys.has(key)
                );
                // 执行keyUp - 释放不再需要的按键
                for (const key of keysToRelease) {
                    keyUp(key);
                    currentPressedKeys.delete(key);
                }
                // 执行keyDown - 按下新需要的按键
                for (const key of keysToPress) {
                    keyDown(key);
                    currentPressedKeys.add(key);
                }
                // 移除已处理的元素
                keyList.shift();
            }
            // 等待指定间隔
            await sleep(gap);
            counter++;
        }
        // 最后释放所有按键
        for (const key of currentPressedKeys) {
            keyUp(key);
        }
        currentPressedKeys.clear();
    }
    /**
     * --------工作函数--------
     */

    music = await read_sheet_music(music_name);
    await use_gadget(auto_gadget);

    if(music.type === "keyboard"){
        log.info(`乐曲名称：${music.name}`);
        log.info(`每拍间隔 ${music.music_gap} ms`);
        presskey_list = music_analyse(music.sheet);
        await play_music(presskey_list, music.music_gap);
    }

})();