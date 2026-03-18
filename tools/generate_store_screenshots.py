from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import sys
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\a1258\Desktop\harmony_metronome_apk_app")
PICTURES_DIR = ROOT / "pictures"
DEFAULT_OUTPUT_DIR = PICTURES_DIR / "store_upload"
MARKETING_OUTPUT_DIR = PICTURES_DIR / "store_upload_marketing"
CANVAS_SIZE = (1920, 1080)
WEBP_MAX_BYTES = 200 * 1024


@dataclass(frozen=True)
class PosterSpec:
    slug: str
    title: str
    subtitle: str
    bullets: tuple[str, ...]
    accent: str
    screenshot_name: str
    screenshot_box: tuple[int, int, int, int]
    crop_focus: tuple[float, float] | None = None
    badge: str | None = None
    secondary_screenshot_name: str | None = None
    secondary_box: tuple[int, int, int, int] | None = None
    secondary_crop_focus: tuple[float, float] | None = None


POSTERS: tuple[PosterSpec, ...] = (
    PosterSpec(
        slug="01_launcher",
        title="打开即用的专业节拍器",
        subtitle="桌面直达，进入应用后即可开始节奏训练。",
        bullets=("鸿蒙桌面一键启动", "练琴练鼓都能快速开始", "界面简洁，上手成本低"),
        accent="#2953E8",
        screenshot_name="1773820169000.jpeg",
        screenshot_box=(1080, 120, 1760, 980),
        crop_focus=(0.46, 0.36),
        badge="桌面入口",
        secondary_screenshot_name="1773820182000.jpeg",
        secondary_box=(760, 310, 1040, 900),
        secondary_crop_focus=(0.5, 0.18),
    ),
    PosterSpec(
        slug="02_bpm",
        title="30-300 BPM 细致调速",
        subtitle="滑杆与步进按钮结合，适合循序渐进地提速练习。",
        bullets=("支持 -5 / -1 / +1 / +5 微调", "范围覆盖慢练到高速训练", "大字号 BPM，读数清晰"),
        accent="#1E63FF",
        screenshot_name="1773820236000.jpeg",
        screenshot_box=(930, 96, 1840, 998),
        crop_focus=(0.5, 0.22),
        badge="速度训练",
    ),
    PosterSpec(
        slug="03_meter",
        title="常用拍号与重音一目了然",
        subtitle="支持预设拍号和自定义拍数，强化强弱拍感知。",
        bullets=("2/4、3/4、4/4、6/8 常用拍号", "支持自定义拍数与音符时值", "重音模式更适合节奏练习"),
        accent="#0C8B7A",
        screenshot_name="1773820236000.jpeg",
        screenshot_box=(960, 96, 1840, 998),
        crop_focus=(0.5, 0.62),
        badge="拍号设置",
    ),
    PosterSpec(
        slug="04_voice",
        title="多语言报拍，后台也能持续播放",
        subtitle="中文、英文、日文语音报拍，边看谱边练也不断拍。",
        bullets=("支持中英日语音报拍", "每拍播报或仅首拍播报", "后台播放，保留当前练习节奏"),
        accent="#6B46D9",
        screenshot_name="1773820182000.jpeg",
        screenshot_box=(1060, 120, 1770, 980),
        crop_focus=(0.5, 0.42),
        badge="语音报拍",
        secondary_screenshot_name="1773820236000.jpeg",
        secondary_box=(760, 640, 1020, 950),
        secondary_crop_focus=(0.5, 0.18),
    ),
)


MARKETING_POSTERS: tuple[PosterSpec, ...] = (
    PosterSpec(
        slug="01_launcher_marketing",
        title="练琴打鼓，一开就能稳住节奏",
        subtitle="从桌面直接进入，少一步操作，多一点专注。",
        bullets=("打开就能开练，减少准备时间", "节拍清楚直接，适合日常高频使用", "练习节奏更稳定，进入状态更快"),
        accent="#1F57FF",
        screenshot_name="1773820169000.jpeg",
        screenshot_box=(1060, 110, 1760, 980),
        crop_focus=(0.46, 0.34),
        badge="练习起点",
        secondary_screenshot_name="1773820182000.jpeg",
        secondary_box=(750, 320, 1030, 910),
        secondary_crop_focus=(0.5, 0.18),
    ),
    PosterSpec(
        slug="02_bpm_marketing",
        title="快慢都稳，速度训练更顺手",
        subtitle="慢练打基础，提速练爆发，一套节拍流程直接覆盖。",
        bullets=("30-300 BPM 全区间覆盖", "按钮微调加滑杆拖动，调速更顺", "大数字显示，练习时一眼就能确认"),
        accent="#1368FF",
        screenshot_name="1773820236000.jpeg",
        screenshot_box=(930, 96, 1840, 998),
        crop_focus=(0.5, 0.22),
        badge="速度冲刺",
    ),
    PosterSpec(
        slug="03_meter_marketing",
        title="拍号清晰，强弱拍一听就对",
        subtitle="常用拍号和重音配置一起到位，复杂节奏也更容易抓住。",
        bullets=("2/4、3/4、4/4、6/8 直接可用", "支持自定义拍数和音符时值", "重音更明确，节奏层次更好听出来"),
        accent="#11907E",
        screenshot_name="1773820236000.jpeg",
        screenshot_box=(960, 96, 1840, 998),
        crop_focus=(0.5, 0.62),
        badge="节奏更准",
    ),
    PosterSpec(
        slug="04_voice_marketing",
        title="语音报拍加后台播放，练习不断拍",
        subtitle="边看谱、边记动作、边走流程，节拍依旧稳定跟着走。",
        bullets=("中英日语音报拍，听感更直观", "可选每拍播报或仅首拍播报", "切到后台也能持续播放，练习不中断"),
        accent="#7B4DFF",
        screenshot_name="1773820182000.jpeg",
        screenshot_box=(1060, 120, 1770, 980),
        crop_focus=(0.5, 0.42),
        badge="持续跟拍",
        secondary_screenshot_name="1773820236000.jpeg",
        secondary_box=(760, 640, 1020, 950),
        secondary_crop_focus=(0.5, 0.18),
    ),
)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    # 使用系统中文字体，保证中文标题渲染正常。
    candidates: Iterable[str] = (
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf" if bold else r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\arial.ttf",
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def create_background(size: tuple[int, int], accent: str) -> Image.Image:
    width, height = size
    base = Image.new("RGB", size, "#F5F8FF")
    overlay = Image.new("RGB", size, "#FFFFFF")

    grad = Image.new("L", (1, height))
    for y in range(height):
        value = int(255 * (y / max(1, height - 1)))
        grad.putpixel((0, y), value)
    grad = grad.resize(size)

    accent_layer = Image.new("RGB", size, accent)
    accent_layer.putalpha(ImageChops.invert(grad))
    base = Image.alpha_composite(base.convert("RGBA"), accent_layer)

    draw = ImageDraw.Draw(base)
    draw.ellipse((-180, -220, 620, 540), fill=hex_to_rgba(accent, 34))
    draw.ellipse((1220, -140, 2040, 620), fill=hex_to_rgba("#FFFFFF", 145))
    draw.rounded_rectangle((82, 78, width - 82, height - 78), radius=48, fill=(255, 255, 255, 238))
    draw.rounded_rectangle((104, 100, width - 104, height - 100), radius=42, outline=hex_to_rgba("#FFFFFF", 225), width=2)
    return base.convert("RGB")


def hex_to_rgba(color: str, alpha: int) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def cover_crop(image: Image.Image, target_size: tuple[int, int], focus: tuple[float, float] | None) -> Image.Image:
    src_w, src_h = image.size
    dst_w, dst_h = target_size
    src_ratio = src_w / src_h
    dst_ratio = dst_w / dst_h

    if src_ratio > dst_ratio:
        crop_h = src_h
        crop_w = int(round(src_h * dst_ratio))
    else:
        crop_w = src_w
        crop_h = int(round(src_w / dst_ratio))

    fx, fy = focus if focus else (0.5, 0.5)
    left = int(round((src_w - crop_w) * fx))
    top = int(round((src_h - crop_h) * fy))
    left = max(0, min(src_w - crop_w, left))
    top = max(0, min(src_h - crop_h, top))
    cropped = image.crop((left, top, left + crop_w, top + crop_h))
    return cropped.resize(target_size, Image.Resampling.LANCZOS)


def draw_card(canvas: Image.Image, box: tuple[int, int, int, int], image: Image.Image) -> None:
    x1, y1, x2, y2 = box
    width = x2 - x1
    height = y2 - y1

    # 统一用圆角卡片包裹原始截图，视觉上更接近应用市场宣传图。
    shadow = Image.new("RGBA", (width + 32, height + 32), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((16, 16, width + 16, height + 16), radius=44, fill=(30, 50, 120, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(shadow, (x1 - 16, y1 - 8), shadow)

    rounded_mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(rounded_mask)
    mask_draw.rounded_rectangle((0, 0, width, height), radius=38, fill=255)

    framed = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    framed.paste(image.convert("RGBA"), (0, 0), rounded_mask)
    border = ImageDraw.Draw(framed)
    border.rounded_rectangle((0, 0, width - 1, height - 1), radius=38, outline=(235, 240, 255, 255), width=3)
    canvas.paste(framed, (x1, y1), framed)


def draw_text_block(canvas: Image.Image, spec: PosterSpec) -> None:
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(66, bold=True)
    subtitle_font = load_font(30)
    bullet_font = load_font(28)
    badge_font = load_font(24, bold=True)

    # 左侧文本区域尽量稳定，方便后续只替换文案继续出图。
    text_left = 170
    current_y = 160

    if spec.badge:
      badge_w = draw.textlength(spec.badge, font=badge_font) + 48
      draw.rounded_rectangle((text_left, current_y, text_left + badge_w, current_y + 48), radius=24, fill=hex_to_rgba(spec.accent, 35))
      draw.text((text_left + 24, current_y + 11), spec.badge, font=badge_font, fill=spec.accent)
      current_y += 84

    title_lines = split_lines(draw, spec.title, title_font, 620)
    for line in title_lines:
        draw.text((text_left, current_y), line, font=title_font, fill="#162033")
        current_y += 84

    current_y += 12
    subtitle_lines = split_lines(draw, spec.subtitle, subtitle_font, 640)
    for line in subtitle_lines:
        draw.text((text_left, current_y), line, font=subtitle_font, fill="#5B6477")
        current_y += 44

    current_y += 42
    for bullet in spec.bullets:
        draw.rounded_rectangle((text_left, current_y + 10, text_left + 14, current_y + 24), radius=7, fill=spec.accent)
        draw.text((text_left + 34, current_y), bullet, font=bullet_font, fill="#1D273A")
        current_y += 68

    chip_font = load_font(23, bold=True)
    chip_y = 850
    chips = ("鸿蒙应用", "节拍训练", "专业练习")
    chip_x = text_left
    for chip in chips:
        chip_w = draw.textlength(chip, font=chip_font) + 40
        draw.rounded_rectangle((chip_x, chip_y, chip_x + chip_w, chip_y + 42), radius=21, fill="#FFFFFF")
        draw.rounded_rectangle((chip_x, chip_y, chip_x + chip_w, chip_y + 42), radius=21, outline=hex_to_rgba(spec.accent, 55), width=2)
        draw.text((chip_x + 20, chip_y + 9), chip, font=chip_font, fill=spec.accent)
        chip_x += chip_w + 14


def split_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for char in text:
        trial = current + char
        if current and draw.textlength(trial, font=font) > max_width:
            lines.append(current)
            current = char
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def build_poster(spec: PosterSpec) -> Image.Image:
    canvas = create_background(CANVAS_SIZE, spec.accent)
    draw_text_block(canvas, spec)

    primary_path = PICTURES_DIR / spec.screenshot_name
    with Image.open(primary_path) as screenshot:
        primary = cover_crop(screenshot, (spec.screenshot_box[2] - spec.screenshot_box[0], spec.screenshot_box[3] - spec.screenshot_box[1]), spec.crop_focus)
    draw_card(canvas, spec.screenshot_box, primary)

    if spec.secondary_screenshot_name and spec.secondary_box:
        secondary_path = PICTURES_DIR / spec.secondary_screenshot_name
        with Image.open(secondary_path) as screenshot:
            secondary = cover_crop(
                screenshot,
                (spec.secondary_box[2] - spec.secondary_box[0], spec.secondary_box[3] - spec.secondary_box[1]),
                spec.secondary_crop_focus,
            )
        draw_card(canvas, spec.secondary_box, secondary)

    return canvas


def ensure_output(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)


def save_webp_under_limit(image: Image.Image, output_path: Path) -> None:
    # 商店对 WEBP 体积要求更严格，这里按质量阶梯压缩直到小于 200 KB。
    for quality in (88, 82, 76, 70, 64, 58, 52, 46, 40):
        buffer = BytesIO()
        image.save(buffer, format="WEBP", quality=quality, method=6)
        if buffer.tell() <= WEBP_MAX_BYTES:
            output_path.write_bytes(buffer.getvalue())
            return

    # 如果仍未命中限制，保留最低质量版本，避免脚本直接失败。
    buffer = BytesIO()
    image.save(buffer, format="WEBP", quality=36, method=6)
    output_path.write_bytes(buffer.getvalue())


def save_all(posters: Iterable[PosterSpec], output_dir: Path) -> list[Path]:
    ensure_output(output_dir)
    outputs: list[Path] = []
    for spec in posters:
        poster = build_poster(spec)
        png_path = output_dir / f"{spec.slug}.png"
        jpg_path = output_dir / f"{spec.slug}.jpg"
        webp_path = output_dir / f"{spec.slug}.webp"
        poster.save(png_path, format="PNG", optimize=True)
        poster.save(jpg_path, format="JPEG", quality=90, optimize=True, progressive=True)
        save_webp_under_limit(poster, webp_path)
        outputs.extend([png_path, jpg_path, webp_path])
    return outputs


def main() -> None:
    variant = sys.argv[1].lower() if len(sys.argv) > 1 else "default"
    variants = {
        "default": (POSTERS, DEFAULT_OUTPUT_DIR),
        "marketing": (MARKETING_POSTERS, MARKETING_OUTPUT_DIR),
    }
    posters, output_dir = variants.get(variant, variants["default"])
    outputs = save_all(posters, output_dir)
    for path in outputs:
        print(path)


if __name__ == "__main__":
    main()
