"""生成清读 CleanRead 图标 — 渐变蓝底 + 白色播放/音波图标"""
from PIL import Image, ImageDraw
import math

COLORS = {
    'gradient_top': '#5BAFE0',    # 浅蓝
    'gradient_bottom': '#3578B0',  # 深蓝
    'white': '#FFFFFF',
}

SIZES = [16, 48, 128]


def create_base(size):
    """创建渐变蓝底圆角方形"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    margin = 0  # 无边距，填满整个画布
    radius = int(size * 0.22)

    # 绘制渐变背景
    top_r, top_g, top_b = hex_to_rgb(COLORS['gradient_top'])
    bot_r, bot_g, bot_b = hex_to_rgb(COLORS['gradient_bottom'])

    for y in range(size):
        ratio = y / size
        r = int(top_r + (bot_r - top_r) * ratio)
        g = int(top_g + (bot_g - top_g) * ratio)
        b = int(top_b + (bot_b - top_b) * ratio)
        draw_line = ImageDraw.Draw(img)
        draw_line.rectangle([0, y, size, y], fill=(r, g, b, 255))

    # 裁剪为圆角
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    # 把 mask 应用到 alpha 通道

    # 直接用 rounded_rectangle 在 mask 上画圆角矩形
    rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        for x in range(size):
            if mask.getpixel((x, y)) > 0:
                rounded.putpixel((x, y), img.getpixel((x, y)))

    return rounded


def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i + 2], 16) for i in (0, 2, 4))


def draw_play_icon(draw, cx, cy, scale, color):
    """绘制播放三角形"""
    size = scale * 0.28
    # 三角形顶点 (指向右)
    points = [
        (cx - size * 0.55, cy - size),       # 左上
        (cx - size * 0.55, cy + size),       # 左下
        (cx + size * 0.85, cy),              # 右顶点
    ]
    draw.polygon(points, fill=color)


def draw_sound_waves(draw, cx, cy, scale, color, size):
    """绘制音波弧线"""
    stroke = max(1.5, scale * 0.06)
    wave_cx = cx + scale * 0.22

    # 两段弧线
    for i in range(2):
        r = scale * (0.14 + i * 0.14)
        bbox = [wave_cx - r, cy - r, wave_cx + r, cy + r]
        # 画上半部分的弧
        draw.arc(bbox, start=290, end=70, fill=color, width=int(stroke))


def draw_icon_for_size(img, size):
    """在图片上绘制图标"""
    draw = ImageDraw.Draw(img)
    center = size / 2
    scale = size

    # 播放按钮（左移一点给音波留空间）
    play_cx = center - scale * 0.08

    if size >= 48:
        # 大尺寸：播放三角 + 音波弧线
        draw_play_icon(draw, play_cx, center, scale, COLORS['white'])
        draw_sound_waves(draw, play_cx, center, scale, COLORS['white'], size)
    else:
        # 小尺寸：只用播放三角，居中
        draw_play_icon(draw, center, center, scale, COLORS['white'])


def main():
    for size in SIZES:
        img = create_base(size)
        draw_icon_for_size(img, size)
        path = f'd:/coding/building/tts-tool/icons/icon{size}.png'
        img.save(path, 'PNG')
        print(f'Saved {path} ({size}x{size})')

    # 为 Chrome Web Store 准备 128 单独一份也 OK
    print('Done — 3 icons generated')


if __name__ == '__main__':
    main()
