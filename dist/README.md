# Cabbageland · 剪纸版

cabbageland.github.io 的剪纸 / 立体书版本。世界是一张会动的纸：松树、大白菜、恐龙、四座房子、农夫、小鸟和 Cabbageclaw 都是单独剪下来的纸片，点一下会弹、会晃、会撒东西。房间里的内容（书架、信箱、笔记本、作曲机、歌单、生命游戏、纸片马赛克、画廊）沿用原网站。

## 本地打开

在仓库根目录运行

```bash
python3 -m http.server 8770
```

然后打开 http://127.0.0.1:8770/ （根目录会跳到 `dist/`；`?lang=zh` 是中文）。改完刷新时用 Cmd+Shift+R，免得浏览器用旧的缓存。

## 文件结构

```
index.html              页面骨架
css/paper.css           纸张风格的界面（白天 / body.night 夜晚两套颜色）
js/world.js             地图：镜头拖动缩放、悬停、点击、白天黑夜、键盘入口
js/paper-stage.js       剪纸动画引擎（Canvas 2D）：纸片、云、水、粒子、Q弹反应
js/paper-sound.js       点击音效 + 跟着留声机音符的八音盒（只在打开声音后播放）
js/rooms.js             六个房间（沿用原网站，画板 / 生命游戏改成纸片方块）
js/world-art.js         房间卡片、地标文字位置、画廊作品
js/translations.js      中英文文案
art/                    房间卡片、图标、Cabbageclaw、画廊图（WebP）
world/source/           原图：day.png（无招牌）、day-signs.png（带招牌）、night.png
world/scene.json        ★ 所有可以改的东西都在这里
world/rebuild.sh        从原图 + scene.json 重新切纸片
world/layers/           生成的纸片（不要手改）
```

## 以后怎么改

**换图**：把新图放进 `world/source/`（尺寸保持 1983×793，建筑位置对齐），然后

```bash
./world/rebuild.sh
```

大约 1 分钟。它会：

1. 用 Real-ESRGAN 把原图 AI 放大（`world/tools/upscale-sources.sh` → `world/source/hd/`，只在原图变了时重跑）。放大器放在 `world/.tools/realesrgan/`，没有它就退回 MetalFX 普通放大。
2. 用 macOS 的 Vision 自动抠出每个纸片，白天和夜晚共用同一套形状。
3. 压成 WebP（需要 `brew install webp`，没有就保留 PNG）。

**改动画 / 加纸片**：只改 `world/scene.json`，再跑一次 rebuild。

- `pieces`：每个纸片的范围（`subject` 自动抠图，或 `polygon` 手画多边形）、`pivot` 转轴、`kind` 动作类型、`spot` 属于哪个地点、`kick: true` 可以单独戳。
- `motions`：每种纸片的待机动作和点击反应（`jelly` 就是 QQ 糖那种弹）。待机的 `cycles` 保持整数，12 秒循环才不会跳。
- `spots`：点击地点时撒什么（星星、音符、代码标签、颜料、爱心、叶子、水滴）和播什么音效。
- `emitters`：一直在发生的小事（音符、萤火虫、蝴蝶、跳鱼、瀑布泡沫……）。
- `water`：`falls` 是瀑布（纸条往下滑，只画在每道瀑布的轮廓里）；`glints` 是平静水面上顺着河道漂的小纸片，`flow` 是方向、`speed` 快慢、`density` 多少。排在前面的区域优先。
- `variants.*.clouds: false`：画里的云（和夜晚的月亮）不剪下来，保持画在底图上，这样永远不会裂开。天空的动感来自 `emitters` 里的 `skydrift`：几朵折纸云在天空后面慢慢飘，只在露出天空的地方看得见（会从玻璃拱、树和画里的云后面穿过）。
- `companion`：Cabbageclaw 走的路线（`path` 是地面上的一串点，顺着地势走、会随坡度倾斜）、`hops` 在哪个点跳一下（现在是书页中间的折缝）、`wave` 点它时停下挥爪几秒（头上会冒出对话气泡）。
- `style`：帧率（待机 12 fps，反应 24 fps）、纸张颗粒 / 光泽、阴影、夜晚水纹强度。

**房间卡片和画廊图**：原图放在 `art/source/`，用 Real-ESRGAN 放大后压成 `art/cards/*.webp`、`art/gallery/*.webp`（`world/tools/mix-upscale.swift` 会把一点原图纸纹混回去）。

**改文字**：`js/translations.js`（中英文都要改）。Petting Zone 和 The Great Cabbage 的介绍还是占位文字，等你写好再换。

## 上线

这个文件夹就是 cabbageland.github.io 的 `dist/`。改完、验证好之后提交并推到 `main`，GitHub Pages 会自动更新（规则见仓库根目录的 `AGENTS.md`）。`world/.build/` 和 `world/.tools/`（Real-ESRGAN 放大器，要自己下载放进去）不进 git。
