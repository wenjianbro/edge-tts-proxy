"""Generate promo images matching design C exactly."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os

FONT_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_REGULAR = 'C:/Windows/Fonts/msyh.ttc'

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def create_diagonal_gradient(w, h, color_stops):
    """color_stops: list of (position 0-1, (r,g,b)) — 135deg (top-left to bottom-right)."""
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    # Projection: 135deg → direction from top-left (0,0) toward bottom-right (1,1)
    xs = np.linspace(0, 1, w)
    ys = np.linspace(0, 1, h)
    xx, yy = np.meshgrid(xs, ys)
    t = (xx + yy) / 2.0  # 0 at top-left, 1 at bottom-right

    for ch in range(3):
        channel = np.zeros_like(t)
        for i in range(len(color_stops) - 1):
            p0, c0 = color_stops[i]
            p1, c1 = color_stops[i + 1]
            mask = (t >= p0) & (t < p1)
            seg = (t[mask] - p0) / (p1 - p0)
            channel[mask] = c0[ch] + seg * (c1[ch] - c0[ch])
        # catch t >= last stop
        mask = t >= color_stops[-1][0]
        channel[mask] = color_stops[-1][1][ch]
        arr[:, :, ch] = channel.astype(np.uint8)

    return Image.fromarray(arr, 'RGB')

def draw_sound_bars(draw, cx, cy, box_size):
    """4-bar SVG icon centered in box_size, scaled from 48px viewBox."""
    scale = box_size * 0.78 / 48.0
    bar_w = 5 * scale
    r = bar_w / 2
    specs = [
        (9,  16, 16, '#93C5FD'),
        (18,  8, 32, '#A5D4FF'),
        (27,  4, 40, '#BFE0FF'),
        (36, 16, 16, '#93C5FD'),
    ]
    for bx, by, bh, color in specs:
        x0 = cx + (bx - 24) * scale
        y0 = cy + (by - 24) * scale
        x1 = x0 + bar_w
        y1 = y0 + bh * scale
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=color)

def generate_small(path):
    W, H = 440, 280
    PAD = 80                    # from .design-c { padding: 0 80px }
    ICON_SZ = 60                # inline style
    ICON_RADIUS = 16
    ICON_MARGIN = 24            # inline style
    NAME_SIZE = 28              # inline style
    TAGLINE_SIZE = 14           # inline style

    stops = [
        (0,    hex_to_rgb('#EEF2FF')),
        (0.5,  hex_to_rgb('#DBE4FF')),
        (1,    hex_to_rgb('#F0F4FF')),
    ]
    img = create_diagonal_gradient(W, H, stops)
    draw = ImageDraw.Draw(img, 'RGBA')

    # --- measure text first to compute centering ---
    name_font = ImageFont.truetype(FONT_BOLD, NAME_SIZE)
    tagline_font = ImageFont.truetype(FONT_REGULAR, TAGLINE_SIZE)

    name_text = '清读 CleanRead'
    tagline_text = '选中即播 · AI 自然语音 · 零配置开箱即用'

    name_bbox = draw.textbbox((0, 0), name_text, font=name_font)
    tagline_bbox = draw.textbbox((0, 0), tagline_text, font=tagline_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_h = name_bbox[3] - name_bbox[1]
    tagline_w = tagline_bbox[2] - tagline_bbox[0]
    tagline_h = tagline_bbox[3] - tagline_bbox[1]

    content_w = ICON_SZ + ICON_MARGIN + max(name_w, tagline_w)
    gap = int(NAME_SIZE * 0.15)
    block_h = name_h + gap + tagline_h

    # Center the whole content block horizontally
    icon_x = (W - content_w) // 2
    icon_y = (H - ICON_SZ) // 2
    text_x = icon_x + ICON_SZ + ICON_MARGIN
    text_y = (H - block_h) // 2

    # --- icon background ---
    draw.rounded_rectangle(
        [icon_x, icon_y, icon_x + ICON_SZ, icon_y + ICON_SZ],
        radius=ICON_RADIUS, fill='#1E1E24'
    )
    draw_sound_bars(draw, icon_x + ICON_SZ // 2, icon_y + ICON_SZ // 2, ICON_SZ)

    # --- text ---
    draw.text((text_x, text_y), name_text, fill='#1E1E24', font=name_font)
    draw.text((text_x, text_y + name_h + gap), tagline_text, fill='#666666', font=tagline_font)

    # --- dim label ---
    label_font = ImageFont.truetype(FONT_REGULAR, 10)
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.text((W - 66, 10), f'{W} × {H}', fill=(0, 0, 0, 51), font=label_font)
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

    img.save(path, 'PNG')
    print(f'Saved {path} ({W}×{H})')

def generate_large(path):
    W, H = 1400, 560
    PAD = 160
    ICON_SZ = 130
    ICON_RADIUS = 30
    ICON_MARGIN = 56
    NAME_SIZE = 72
    TAGLINE_SIZE = 30

    stops = [
        (0,    hex_to_rgb('#EEF2FF')),
        (0.5,  hex_to_rgb('#DBE4FF')),
        (1,    hex_to_rgb('#F0F4FF')),
    ]
    img = create_diagonal_gradient(W, H, stops)
    draw = ImageDraw.Draw(img, 'RGBA')

    # --- measure text first to compute centering ---
    name_font = ImageFont.truetype(FONT_BOLD, NAME_SIZE)
    tagline_font = ImageFont.truetype(FONT_REGULAR, TAGLINE_SIZE)

    name_text = '清读 CleanRead'
    tagline_text = '选中即播 · AI 自然语音 · 零配置开箱即用'

    name_bbox = draw.textbbox((0, 0), name_text, font=name_font)
    tagline_bbox = draw.textbbox((0, 0), tagline_text, font=tagline_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_h = name_bbox[3] - name_bbox[1]
    tagline_w = tagline_bbox[2] - tagline_bbox[0]
    tagline_h = tagline_bbox[3] - tagline_bbox[1]

    content_w = ICON_SZ + ICON_MARGIN + max(name_w, tagline_w)
    gap = int(NAME_SIZE * 0.15)
    block_h = name_h + gap + tagline_h

    # Center the whole content block horizontally
    icon_x = (W - content_w) // 2
    icon_y = (H - ICON_SZ) // 2
    text_x = icon_x + ICON_SZ + ICON_MARGIN
    text_y = (H - block_h) // 2

    # --- icon background ---
    draw.rounded_rectangle(
        [icon_x, icon_y, icon_x + ICON_SZ, icon_y + ICON_SZ],
        radius=ICON_RADIUS, fill='#1E1E24'
    )
    draw_sound_bars(draw, icon_x + ICON_SZ // 2, icon_y + ICON_SZ // 2, ICON_SZ)

    # --- text ---
    draw.text((text_x, text_y), name_text, fill='#1E1E24', font=name_font)
    draw.text((text_x, text_y + name_h + gap), tagline_text, fill='#666666', font=tagline_font)

    # --- dim label ---
    label_font = ImageFont.truetype(FONT_REGULAR, 13)
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.text((W - 112, 14), f'{W} × {H}', fill=(0, 0, 0, 51), font=label_font)
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

    img.save(path, 'PNG')
    print(f'Saved {path} ({W}×{H})')


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    generate_small(os.path.join(base, 'promo-small.png'))
    generate_large(os.path.join(base, 'promo-large.png'))
    print('Done.')
