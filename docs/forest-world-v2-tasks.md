# 林间世界 V2.0 开发清单

## 已完成

- [x] 全局行囊，最多携带 3 段记忆，支持 `Q` 打开与跨区域读取
- [x] 苔灯邀请、遣散、地图跟随、池塘熄灯与授权说明
- [x] 亮灯木屋门廊、最近线索、邮箱纸鸟与旅程回声
- [x] 记忆花园三段式遭遇、原文阅读、今日批注与携带
- [x] 循光寻迹、候选关联、用户判断与小径命名
- [x] 篝火四种姿态、受限记忆授权、三层火光与离场产物
- [x] 静水池塘静坐、临时放下、会话漂流瓶与本次倒影
- [x] 共居工坊具体问题、背对书写、同时翻牌、四种差异处理
- [x] 工坊语义载体、双方确认、地图即时放置与来源回访
- [x] 世界足迹、窗边回声、地图背景保留和统一像素 UI
- [x] 键盘、移动端、减少动态模式与异常降级保留

## 图片资产需求

当前版本复用了已有地图、角色、物件图集与 `forest-companion.png`，功能完整，不阻塞使用。若继续提高像素一致性，建议生成以下资产。

### 1. 苔灯地图 Sprite Sheet

- 用途：替换地图上缩放后的方形苔灯插画
- 画布：`256 × 128`，透明背景，8 格，每格 `32 × 64`
- 动作：暖光待机 2 帧、微蓝照见 2 帧、熄灯 2 帧、跳动移动 2 帧
- 提示词：

```text
2D pixel art sprite sheet, Stardew Valley inspired warm forest fantasy, a tiny non-human moss lantern spirit, wooden and stone lantern base, moss and two tender leaves, no arms, no humanoid face, subtle friendly eyes only, transparent background, strict 32x64 pixel cells, 8 frames in one horizontal row: warm idle x2, pale blue insight glow x2, light off x2, tiny hopping movement x2, consistent silhouette and scale, crisp hard pixel edges, no text, no shadow outside each cell
```

参考：`public/game/forest-companion.png` 的苔藓、嫩叶和暖光；`public/game/twilight-character-atlas-cutout.png` 的像素密度。

### 2. 足迹与光路特效图集

- 用途：替换 Canvas 中的简化足迹与候选光路
- 画布：`256 × 128`，透明背景
- 内容：单人脚印、双人脚印、坐过的石头、暖色光粒、微蓝光路节点、窗边光粒
- 提示词：

```text
pixel art game effect atlas, Stardew Valley inspired twilight forest palette, transparent background, separate clean sprites with generous spacing: small single footprints, paired footprints, a sat-on mossy stone, warm amber light mote, pale blue trail node, tiny cabin window memory light, 16 to 32 pixel scale, crisp pixels, subtle dark teal and warm ochre palette, no text, no UI frame
```

参考：`public/game/twilight-world-map-v3.png` 的深青森林、赭木和暖灯配色。

### 3. 工坊五种载体补充图集

- 用途：让长椅、双面路牌、灯笼、里程碑、木箱具有准确语义
- 画布：`320 × 64`，透明背景，每格 `64 × 64`
- 提示词：

```text
2D pixel art object sprite sheet, five separate outdoor workshop keepsakes in one horizontal row, transparent background, Stardew Valley inspired handcrafted wood style: two-seat bench, double-sided signpost, warm paper lantern, modest stone-and-wood milestone, closed wooden keepsake chest, each centered in a 64x64 cell, same perspective as an isometric-ish top-down RPG map, moonlit teal shadows with warm amber highlights, no characters, no text
```

参考：`public/game/twilight-object-atlas-cutout.png` 的视角和尺寸；`public/game/twilight-world-map-v3.png` 的工坊区域。
