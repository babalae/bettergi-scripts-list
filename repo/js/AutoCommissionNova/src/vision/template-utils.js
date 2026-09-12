/**
 * 模板匹配识别
 *
 * 截屏 + 在当前游戏画面里查找一个已注册的 RO 模板的所有出现位置
 * 调用方传入 RO.xxx（来自 src/vision/templates）即可，资源生命周期由 RO 命名空间统一管理
 *
 * @param {Object} ro - 已构造好的 RecognitionObject（如 RO.talkExit）
 * @returns {Promise<Object>} 匹配结果（含 count 字段；count=0 表示无匹配或出错）
 */
export async function captureAndFindMulti(ro) {
    let cap;
    try {
        cap = captureGameRegion();
        return await cap.findMulti(ro);
    } catch (error) {
        log.error("TemplateMatch 识别出错：{error}", error.message);
        return { count: 0 };
    } finally {
        cap?.Dispose();
    }
}
