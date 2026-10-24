/** 绘制调试区域并在短暂显示后清理资源。 */
export async function drawBox(show, result, delay = 200, pen) {
    if (show) await drawAndClearBox(result, delay, pen);
}

export async function drawAndClearBox(result, delay = 200, pen) {
    const capture = captureGameRegion();
    try {
        const drawRegion = capture.DeriveCrop(result.x, result.y, result.width, result.height);
        try {
            drawRegion.DrawSelf("icon", pen || new Pen(Color.Red, 2));
            await sleep(delay);
        } finally {
            drawRegion.dispose();
        }
    } finally {
        capture.dispose();
    }
}
