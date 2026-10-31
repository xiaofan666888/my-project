# 美术原图放这里

把 AI 出的（或画师给的）五张表情图放进这个目录，然后运行：

```powershell
& 'C:\Users\guozifan\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' 'D:\项目\tools\prepare-art.py'
```

它会自动完成：

1. 从四角泛洪去白底（有白底的话）
2. 裁到内容边界
3. 等比缩到 1024
4. 压缩到单张 180 KB 以内
5. 重命名为 `me-normal.png` / `me-happy.png` / `me-angry.png` / `me-sad.png` / `me-sleep.png` 写进 `miniprogram/images/me/`
6. 生成一张对比图（`.tmp/art-preview.png`）方便检查

## 命名要求

文件名里**包含表情关键词**即可自动识别，例如：

```
me-normal.png      或   normal_v2.jpg
me-happy.png       或   happy_ai.png
```

如果文件名没有关键词，会按字母序依次对应 normal / happy / angry / sad / sleep。

## 这里的内容不会进仓库

`.gitignore` 已排除 `art_source/` 下的所有图片，只保留这个说明文件。
原因是这些原图可能包含真人照片或第三方素材，不适合公开。
处理后的成品会进仓库（因为已经过裁切压缩，且通常是原创或已授权）。

## 出图要求（给 AI 或画师的规格）

| 项 | 要求 |
|---|---|
| 数量 | 5 张，同一角色、同一构图 |
| 内容 | 半身胸像，正面，黑长直中分，黑 T |
| 背景 | 纯白或透明 |
| 尺寸 | 1024×1024 足够，不必 4K |
| 表情 | 平静 / 开心 / 生气 / 难过 / 睡着 |
