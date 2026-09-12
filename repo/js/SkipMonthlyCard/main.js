// 图片资源缓存
const img_cache = {};
const template_cache = {};

// 获取图片资源
function getImgMat(path) {
  if (!img_cache[path]) {
    img_cache[path] = file.readImageMatSync('assets/' + path + '.png');
  }
  return img_cache[path];
}

// 获取模板
function getTemplate(path) {
  if (!template_cache[path]) {
    const img_mat = getImgMat(path);
    template_cache[path] = RecognitionObject.TemplateMatch(
      img_mat,
      0, 0, 1920, 1080
    );
  }
  return template_cache[path];
}

// 查找图片
async function findImage(path) {
  const searchImg = getTemplate(path);

  const captureRegion = captureGameRegion();
  const result = captureRegion.find(searchImg);
  captureRegion.dispose();

  return result.isExist();
}

(async function () {
  let success = false;
  await genshin.returnMainUi();

  while (true) {
    const result1 = await findImage("girl_moon");
    const result2 = await findImage("welkin_moon_logo");
    if (result1 || result2) {
      log.info("点击月神");
      await sleep(200);
      click(100, 100);
      await sleep(200);
    }

    const stone = await findImage("primogem");
    if (stone) {
      log.info("点击原石");
      while (true) {
        await sleep(200);
        click(100, 100);
        await sleep(200);
        const isInMainUI = await findImage("paimon_menu");
        if (isInMainUI) {
          log.info("已进入主页面");
          success = true;
          await sleep(500);
          break;
        }
      }
    }

    if (success) {
      break;
    }

    await sleep(2000);
  }
})();
