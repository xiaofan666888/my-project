# 美术接入工具：把任意来源的五张表情图，处理成项目能直接用的资源
#
# 用法：
#   1. 把图片放进 D:\项目\art_source\
#   2. 文件名带 normal / happy / angry / sad / sleep 任意关键词即可自动识别
#      （不带关键词时，按文件名字母序依次当作 normal/happy/angry/sad/sleep）
#   3. 运行：
#      python tools/prepare-art.py
#   4. 输出到 miniprogram/images/me/，并在 .tmp 生成对比图
#
# 处理内容：去白底（可选）、裁到内容边界、统一到 1024、压缩、重命名

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os
import sys

SRC_DIR = r"D:\项目\art_source"
OUT_DIR = r"D:\项目\miniprogram\images\me"
PREVIEW = r"D:\项目\.tmp\art-preview.png"
TARGET = 1024
EXPRS = ["normal", "happy", "angry", "sad", "sleep"]


def remove_white(im, thresh=32):
    """从四角泛洪去白底，保留内部白色（比如眼白）"""
    rgb = im.convert("RGB")
    w, h = rgb.size
    mark = (255, 0, 255)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for pt in seeds:
        try:
            ImageDraw.floodfill(rgb, pt, mark, thresh=thresh)
        except Exception:
            pass

    arr = np.array(rgb)
    is_bg = (arr[:, :, 0] == 255) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 255)
    if is_bg.mean() < 0.05:
        return im  # 几乎没有白底，保持原样

    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(a_img)
    return out


def crop_and_resize(im):
    alpha = im.split()[-1] if im.mode == "RGBA" else None
    if alpha is not None:
        bbox = alpha.point(lambda v: 255 if v > 10 else 0).getbbox()
    else:
        bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    scale = TARGET / max(im.width, im.height)
    return im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)


def save_optimized(im, path, budget_kb=180):
    """先直接存，超过预算就逐步减少色数"""
    im.save(path, "PNG", optimize=True)
    kb = os.path.getsize(path) / 1024
    if kb <= budget_kb:
        return kb
    for colors in (256, 192, 160, 128, 96):
        q = im.quantize(colors=colors, method=Image.FASTOCTREE)
        q.save(path, "PNG", optimize=True)
        kb = os.path.getsize(path) / 1024
        if kb <= budget_kb:
            return kb
    return kb


def detect(paths):
    """把文件映射到五个表情"""
    mapping = {}
    for p in paths:
        low = os.path.basename(p).lower()
        for e in EXPRS:
            if e in low:
                mapping[e] = p
                break
    missing = [e for e in EXPRS if e not in mapping]
    if missing and len(paths) >= len(EXPRS):
        rest = [p for p in paths if p not in mapping.values()]
        for e in missing:
            if rest:
                mapping[e] = rest.pop(0)
    return mapping


def main():
    if not os.path.isdir(SRC_DIR):
        os.makedirs(SRC_DIR, exist_ok=True)
        print("已创建目录：", SRC_DIR)
        print("把五张表情图放进去，再运行一次。")
        return

    files = sorted(
        os.path.join(SRC_DIR, f) for f in os.listdir(SRC_DIR)
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    )
    if not files:
        print("目录是空的：", SRC_DIR)
        return

    mapping = detect(files)
    missing = [e for e in EXPRS if e not in mapping]
    if missing:
        print("缺少表情：", ", ".join(missing))
        print("请让文件名包含这些关键词，或确保至少有 5 张图。")
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    thumbs = []
    total = 0
    for e in EXPRS:
        im = Image.open(mapping[e])
        im = remove_white(im)
        im = crop_and_resize(im)
        out = os.path.join(OUT_DIR, "me-%s.png" % e)
        kb = save_optimized(im, out)
        total += kb
        thumbs.append((e, im))
        print("%-8s <- %-28s %5.0f KB" % (e, os.path.basename(mapping[e]), kb))

    print("合计 %.0f KB" % total)
    if total > 900:
        print("提醒：超过 900 KB，建议再压一轮（可以让我做）")

    # 对比图
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    cell = 320
    pad = 16
    sheet = Image.new("RGBA", (cell * 5 + pad * 6, cell + pad * 2 + 24), (250, 250, 252, 255))
    d = ImageDraw.Draw(sheet)
    for i, (e, im) in enumerate(thumbs):
        t = im.copy()
        t.thumbnail((cell, cell))
        x = pad + i * (cell + pad) + (cell - t.width) // 2
        y = pad + (cell - t.height) // 2
        sheet.paste(t, (x, y), t)
        d.text((pad + i * (cell + pad) + 4, cell + pad + 4), e, fill=(90, 90, 110))
    sheet.convert("RGB").save(PREVIEW)
    print("对比图：", PREVIEW)


if __name__ == "__main__":
    main()
