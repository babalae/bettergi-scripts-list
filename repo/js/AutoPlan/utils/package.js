export class ImageRegionSafe {
    constructor(imageRegion) {
        if (!(imageRegion instanceof ImageRegion)) {
            throw new Error('参数必须是 ImageRegion 类型');
        }
        this.imageRegion = imageRegion;
    }

    // 安全释放方法（清空引用）
    safeDispose() {
        if (this.imageRegion) {
            this.imageRegion?.dispose();
            this.imageRegion = null;
        }
    }

    // 静态安全释放方法（清空引用）
    static safeDispose(imageRegion) {
        if (imageRegion) {
            imageRegion?.dispose();
        }
    }
}

