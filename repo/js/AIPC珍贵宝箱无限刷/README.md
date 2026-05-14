# AutoInfinitePreciousChest

## 脚本用途

AutoInfinitePreciousChest&&&默认按键检测&背包物品检测&拾取状态检测

## 资源用途

本目录包含脚本运行所需的资源文件，以下用途根据资源文件名、目录名和 `main.js` 中的资源引用进行保守推断：

- 地图追踪或自动路径 JSON，供脚本加载对应路线。
  - `Assets/AutoPath/前往地点(工程模式).json`
  - `Assets/AutoPath/前往地点.json`
  - `Assets/AutoPath/宝箱(HP版循环).json`
  - `Assets/AutoPath/宝箱(循环).json`
- 界面、图标、物品或状态识别模板图片。
  - `Assets/RecognitionObject/Cabbage.png`
  - `Assets/RecognitionObject/Materials.png`
  - `Assets/RecognitionObject/MaterialsSelected.png`
  - `Assets/RecognitionObject/Max.png`
  - `Assets/RecognitionObject/Radish.png`
- 界面按钮或状态识别模板图片。
  - `Assets/RecognitionObject/AbandonCurrentHangoutEventButton.png`
  - `Assets/RecognitionObject/ConfirmButton.png`
  - `Assets/RecognitionObject/HangoutEventButtonSelected1.png`
  - `Assets/RecognitionObject/HangoutEventButtonSelected2.png`
  - `Assets/RecognitionObject/HangoutEventButtonSelected3.png`
  - `Assets/RecognitionObject/InProgressButton.png`
  - `Assets/RecognitionObject/InProgressButtonSelected.png`
  - `Assets/RecognitionObject/LocationButton.png`
  - `Assets/RecognitionObject/PlusButton.png`
  - `Assets/RecognitionObject/RestoreButton.png`
  - `Assets/RecognitionObject/SettingsButton.png`
  - `Assets/RecognitionObject/Slider.png`
  - `Assets/RecognitionObject/SliderBottom.png`
  - `Assets/RecognitionObject/StoryQuestsButton.png`

## 注意事项

- 请保持资源文件的相对路径不变，避免脚本无法加载。
- 若替换识别图片或路径 JSON，请同步检查 `main.js` 中的引用。
- 未能从文件名或引用明确判断的资源，按“用于脚本运行所需的识别或配置资源”处理。
