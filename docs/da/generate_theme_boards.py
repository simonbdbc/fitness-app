from __future__ import annotations

import math
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


DA_DIR = Path(__file__).resolve().parent
SCREENSHOTS_DIR = DA_DIR / "screenshots"
BOARDS_DIR = DA_DIR / "boards"
BOARDS_DIR.mkdir(parents=True, exist_ok=True)


SOURCE_LIGHT = {
    "background": "#f7f8f5",
    "surface": "#ffffff",
    "surfaceElevated": "#ffffff",
    "surfaceMuted": "#eef2ea",
    "border": "#d7dfd1",
    "borderSoft": "#e6ece1",
    "textPrimary": "#16211b",
    "textSecondary": "#415347",
    "textMuted": "#66756a",
    "accent": "#1f7a4d",
    "accentSoft": "#dff2e7",
    "primaryBackground": "#123f2b",
    "primaryText": "#ffffff",
    "inputBackground": "#ffffff",
    "dangerText": "#a0182b",
    "dangerSurface": "#ffe8ec",
    "successText": "#17623c",
    "successSurface": "#e3f5ea",
    "infoText": "#1d4d8f",
    "infoSurface": "#e8f1ff",
    "warningText": "#7a4d00",
    "warningSurface": "#fff2cc",
}


DIRECTIONS = [
    {
        "slug": "acrea-origin",
        "name": "ACREA Origin",
        "summary": "Vert organique affiné, sobre, lisible, directement aligné avec le MVP actuel.",
        "positioning": "Le choix le plus sûr pour un produit de progression sportive sérieux et accessible.",
        "strengths": "Très cohérent avec l’existant, faible coût d’implémentation, statuts déjà naturels.",
        "watchouts": "Moins différenciant visuellement que les autres directions.",
        "light": {
            "background": "#f6f8f3",
            "surface": "#ffffff",
            "surfaceElevated": "#ffffff",
            "surfaceMuted": "#edf3ea",
            "border": "#d9e2d3",
            "borderSoft": "#e8eee4",
            "textPrimary": "#122018",
            "textSecondary": "#3f5145",
            "textMuted": "#68766d",
            "accent": "#22784f",
            "accentSoft": "#ddf2e6",
            "primaryBackground": "#104d34",
            "primaryText": "#ffffff",
            "inputBackground": "#ffffff",
            "dangerText": "#a21d32",
            "dangerSurface": "#ffe8ec",
            "successText": "#1a7245",
            "successSurface": "#e1f5e9",
            "infoText": "#24518f",
            "infoSurface": "#e8f1ff",
            "warningText": "#7d5408",
            "warningSurface": "#fff3cf",
        },
        "dark": {
            "background": "#0f1411",
            "surface": "#171d19",
            "surfaceElevated": "#202720",
            "surfaceMuted": "#243026",
            "border": "#344238",
            "borderSoft": "#29342d",
            "textPrimary": "#f0f7ef",
            "textSecondary": "#cbd9cd",
            "textMuted": "#9aac9f",
            "accent": "#73d99a",
            "accentSoft": "#1e3d2b",
            "primaryBackground": "#73d99a",
            "primaryText": "#08160f",
            "inputBackground": "#121713",
            "dangerText": "#ff9aaa",
            "dangerSurface": "#3a1820",
            "successText": "#90ebb0",
            "successSurface": "#163622",
            "infoText": "#9fc5ff",
            "infoSurface": "#172b46",
            "warningText": "#ffd27a",
            "warningSurface": "#352915",
        },
    },
    {
        "slug": "graphite-pulse",
        "name": "Graphite Pulse",
        "summary": "Graphite, vert électrique et bleu froid pour une lecture plus premium et performance.",
        "positioning": "Idéal si l’app doit paraître plus coach sportif moderne que carnet d’entraînement.",
        "strengths": "Plus distinctif, excellent en dark mode, très bon contraste des CTA.",
        "watchouts": "Le côté premium peut paraître plus froid et moins pédagogique.",
        "light": {
            "background": "#f4f6f7",
            "surface": "#ffffff",
            "surfaceElevated": "#ffffff",
            "surfaceMuted": "#eef2f4",
            "border": "#d5dde3",
            "borderSoft": "#e6edf1",
            "textPrimary": "#111820",
            "textSecondary": "#3f4c59",
            "textMuted": "#64717d",
            "accent": "#148f63",
            "accentSoft": "#dff8ec",
            "primaryBackground": "#101820",
            "primaryText": "#f7fbff",
            "inputBackground": "#ffffff",
            "dangerText": "#b4232f",
            "dangerSurface": "#ffe3e8",
            "successText": "#087547",
            "successSurface": "#dcfce7",
            "infoText": "#1d4ed8",
            "infoSurface": "#eaf2ff",
            "warningText": "#8a5200",
            "warningSurface": "#fff0c2",
        },
        "dark": {
            "background": "#0c0f13",
            "surface": "#14191f",
            "surfaceElevated": "#1b222a",
            "surfaceMuted": "#202a33",
            "border": "#33404c",
            "borderSoft": "#26313b",
            "textPrimary": "#f4f7fb",
            "textSecondary": "#c8d3dd",
            "textMuted": "#93a2b0",
            "accent": "#2ee68d",
            "accentSoft": "#12382a",
            "primaryBackground": "#2ee68d",
            "primaryText": "#06110b",
            "inputBackground": "#10151a",
            "dangerText": "#ff8aa0",
            "dangerSurface": "#3b1821",
            "successText": "#8dffb3",
            "successSurface": "#123423",
            "infoText": "#7ab7ff",
            "infoSurface": "#132a45",
            "warningText": "#ffcf65",
            "warningSurface": "#332713",
        },
    },
    {
        "slug": "terra-kinesis",
        "name": "Terra Kinesis",
        "summary": "Argile, olive et ivoire pour une app plus humaine, corporelle et méthodique.",
        "positioning": "Bon choix si la marque veut rassurer et accompagner plutôt que pousser la performance.",
        "strengths": "Chaleureux, mémorable, bien adapté au poids du corps et aux règles de sécurité.",
        "watchouts": "À doser finement pour éviter un rendu trop wellness ou trop doux.",
        "light": {
            "background": "#f8f5ed",
            "surface": "#fffdf7",
            "surfaceElevated": "#ffffff",
            "surfaceMuted": "#eef0df",
            "border": "#ddd8c4",
            "borderSoft": "#ebe6d6",
            "textPrimary": "#221d16",
            "textSecondary": "#554b3e",
            "textMuted": "#736957",
            "accent": "#6f7f35",
            "accentSoft": "#ebf2cf",
            "primaryBackground": "#566b2b",
            "primaryText": "#ffffff",
            "inputBackground": "#fffdf7",
            "dangerText": "#a93a32",
            "dangerSurface": "#ffe5df",
            "successText": "#4f7436",
            "successSurface": "#e8f2d8",
            "infoText": "#2d5d73",
            "infoSurface": "#e2f1f5",
            "warningText": "#92520e",
            "warningSurface": "#fff0ce",
        },
        "dark": {
            "background": "#191713",
            "surface": "#211f19",
            "surfaceElevated": "#29261e",
            "surfaceMuted": "#2d2b20",
            "border": "#484333",
            "borderSoft": "#373326",
            "textPrimary": "#f5f0e4",
            "textSecondary": "#d6ccb9",
            "textMuted": "#a99f8b",
            "accent": "#b6c96a",
            "accentSoft": "#30391e",
            "primaryBackground": "#b6c96a",
            "primaryText": "#17180c",
            "inputBackground": "#191713",
            "dangerText": "#ff9a8e",
            "dangerSurface": "#3f1e19",
            "successText": "#c3e48c",
            "successSurface": "#26351b",
            "infoText": "#9ed4e8",
            "infoSurface": "#17303a",
            "warningText": "#ffc477",
            "warningSurface": "#3b2816",
        },
    },
    {
        "slug": "neon-coach",
        "name": "Neon Coach",
        "summary": "Cyan, lime et orange pour une app plus intense, rythmée et guidée.",
        "positioning": "Direction la plus énergique, pertinente si le guide d’exercice devient central.",
        "strengths": "Très identifiable, excellente présence dark mode, donne du rythme aux timers et CTA.",
        "watchouts": "À réserver à un ton plus coach ; peut être trop intense pour une app de suivi calme.",
        "light": {
            "background": "#f5f8f8",
            "surface": "#ffffff",
            "surfaceElevated": "#ffffff",
            "surfaceMuted": "#edf5f2",
            "border": "#d4e4e0",
            "borderSoft": "#e5f0ed",
            "textPrimary": "#071719",
            "textSecondary": "#344b4f",
            "textMuted": "#607378",
            "accent": "#008f8a",
            "accentSoft": "#d9fbf3",
            "primaryBackground": "#007f78",
            "primaryText": "#ffffff",
            "inputBackground": "#ffffff",
            "dangerText": "#b4234a",
            "dangerSurface": "#ffe2eb",
            "successText": "#007a46",
            "successSurface": "#dcfce7",
            "infoText": "#0069b8",
            "infoSurface": "#e1f4ff",
            "warningText": "#9b4d00",
            "warningSurface": "#ffedcc",
        },
        "dark": {
            "background": "#080d10",
            "surface": "#10181d",
            "surfaceElevated": "#162129",
            "surfaceMuted": "#1b2a31",
            "border": "#29404a",
            "borderSoft": "#20323a",
            "textPrimary": "#f2fbff",
            "textSecondary": "#c4dce4",
            "textMuted": "#8fa7af",
            "accent": "#3ff5d0",
            "accentSoft": "#123a35",
            "primaryBackground": "#caff45",
            "primaryText": "#07100a",
            "inputBackground": "#0d1418",
            "dangerText": "#ff6f8d",
            "dangerSurface": "#3b1421",
            "successText": "#8fff6d",
            "successSurface": "#19351b",
            "infoText": "#62d9ff",
            "infoSurface": "#102e3f",
            "warningText": "#ff9f3f",
            "warningSurface": "#3a2412",
        },
    },
]


MAPPED_ROLES = [
    "background",
    "surface",
    "surfaceElevated",
    "surfaceMuted",
    "border",
    "borderSoft",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "accent",
    "accentSoft",
    "primaryBackground",
    "primaryText",
    "inputBackground",
    "dangerText",
    "dangerSurface",
    "successText",
    "successSurface",
    "infoText",
    "infoSurface",
    "warningText",
    "warningSurface",
]


SWATCH_ROLES = [
    "background",
    "surface",
    "surfaceMuted",
    "border",
    "textPrimary",
    "textSecondary",
    "accent",
    "primaryBackground",
    "successText",
    "infoText",
    "warningText",
    "dangerText",
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#" + "".join(f"{component:02x}" for component in rgb)


def rel_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(value: int) -> float:
        value = value / 255
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(component) for component in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: str, b: str) -> float:
    first = rel_luminance(hex_to_rgb(a))
    second = rel_luminance(hex_to_rgb(b))
    lighter = max(first, second)
    darker = min(first, second)
    return (lighter + 0.05) / (darker + 0.05)


SOURCE_RGB = {role: hex_to_rgb(SOURCE_LIGHT[role]) for role in MAPPED_ROLES}


def nearest_role(rgb: tuple[int, int, int]) -> tuple[str, float]:
    role, distance = min(
        (
            (
                source_role,
                math.sqrt(
                    (rgb[0] - source_rgb[0]) ** 2
                    + (rgb[1] - source_rgb[1]) ** 2
                    + (rgb[2] - source_rgb[2]) ** 2
                ),
            )
            for source_role, source_rgb in SOURCE_RGB.items()
        ),
        key=lambda item: item[1],
    )
    return role, distance


def blended_rgb(a: tuple[int, int, int], b: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(a[index] * (1 - ratio) + b[index] * ratio) for index in range(3))


def recolor_image(source_path: Path, target_tokens: dict[str, str], output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    target_rgb = {role: hex_to_rgb(value) for role, value in target_tokens.items()}
    pixels = source.load()
    width, height = source.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue

            role, distance = nearest_role((r, g, b))
            if distance <= 90:
                pixels[x, y] = (*target_rgb[role], a)
                continue

            # Anti-aliased text and borders are blends between source tokens. Re-map
            # neutral leftovers by luminance so dark-mode previews do not keep light halos.
            spread = max(r, g, b) - min(r, g, b)
            if spread <= 32:
                lum = (r + g + b) / 3
                if lum >= 238:
                    pixels[x, y] = (*target_rgb["background"], a)
                elif lum >= 214:
                    pixels[x, y] = (*target_rgb["surface"], a)
                elif lum >= 178:
                    pixels[x, y] = (*target_rgb["borderSoft"], a)
                elif lum >= 120:
                    pixels[x, y] = (*target_rgb["textMuted"], a)
                elif lum >= 68:
                    pixels[x, y] = (*target_rgb["textSecondary"], a)
                else:
                    pixels[x, y] = (*target_rgb["textPrimary"], a)
                continue

            # Preserve subtle antialiasing around colored text by blending toward the
            # closest mapped role instead of leaving the original hue in place.
            if distance <= 135:
                original = SOURCE_RGB[role]
                target = target_rgb[role]
                original_lum = max(1, sum(original) / 3)
                pixel_lum = sum((r, g, b)) / 3
                ratio = min(1.0, max(0.0, pixel_lum / original_lum))
                pixels[x, y] = (*blended_rgb(target_rgb["background"], target, ratio), a)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    source.save(output_path)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = "/System/Library/Fonts/SFNS.ttf" if bold else "/System/Library/Fonts/SFNS.ttf"
    try:
        return ImageFont.truetype(path, size=size)
    except OSError:
        return ImageFont.load_default(size=size)


FONT_H1 = font(48, bold=True)
FONT_H2 = font(34, bold=True)
FONT_H3 = font(24, bold=True)
FONT_BODY = font(18)
FONT_SMALL = font(14)
FONT_TINY = font(12)


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: str, width: int, font_obj: ImageFont.ImageFont, line_gap: int = 6) -> int:
    x, y = xy
    max_chars = max(18, width // 10)
    for line in wrap(text, max_chars):
        draw.text((x, y), line, fill=fill, font=font_obj)
        y += font_obj.size + line_gap
    return y


def resize_phone(path: Path, width: int) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    ratio = width / image.width
    return image.resize((width, round(image.height * ratio)), Image.Resampling.LANCZOS)


def paste_with_frame(canvas: Image.Image, image: Image.Image, xy: tuple[int, int], label: str, draw: ImageDraw.ImageDraw) -> None:
    x, y = xy
    draw.rounded_rectangle((x - 10, y - 10, x + image.width + 10, y + image.height + 36), radius=18, fill="#ffffff", outline="#d8ddd8", width=1)
    canvas.alpha_composite(image, (x, y))
    draw.text((x, y + image.height + 10), label, fill="#415347", font=FONT_SMALL)


def draw_swatches(draw: ImageDraw.ImageDraw, tokens: dict[str, str], x: int, y: int, title: str, columns: int = 2) -> int:
    draw.text((x, y), title, fill="#16211b", font=FONT_H3)
    y += 38
    swatch_w = 150
    swatch_h = 46
    gap_x = 18
    gap_y = 16
    for index, role in enumerate(SWATCH_ROLES):
        col = index % columns
        row = index // columns
        sx = x + col * (swatch_w + gap_x)
        sy = y + row * (swatch_h + gap_y)
        draw.rounded_rectangle((sx, sy, sx + swatch_w, sy + swatch_h), radius=9, fill=tokens[role], outline="#cfd6cf", width=1)
        draw.text((sx, sy + swatch_h + 3), role, fill="#415347", font=FONT_TINY)
    return y + ((len(SWATCH_ROLES) + columns - 1) // columns) * (swatch_h + gap_y) + 18


def draw_contrast(draw: ImageDraw.ImageDraw, tokens: dict[str, str], x: int, y: int, title: str) -> int:
    pairs = [
        ("body/bg", "textPrimary", "background"),
        ("body/card", "textPrimary", "surface"),
        ("muted/card", "textSecondary", "surface"),
        ("primary", "primaryText", "primaryBackground"),
        ("success", "successText", "successSurface"),
        ("info", "infoText", "infoSurface"),
        ("warning", "warningText", "warningSurface"),
        ("danger", "dangerText", "dangerSurface"),
    ]
    draw.text((x, y), title, fill="#16211b", font=FONT_H3)
    y += 36
    for label, fg, bg in pairs:
        ratio = contrast_ratio(tokens[fg], tokens[bg])
        ok = ratio >= 4.5
        fill = "#e8f5ec" if ok else "#fff0d8"
        outline = "#2d7a4d" if ok else "#9b5c00"
        draw.rounded_rectangle((x, y, x + 320, y + 34), radius=8, fill=fill, outline=outline, width=1)
        draw.text((x + 12, y + 8), f"{label}: {ratio:.1f}:1", fill="#16211b", font=FONT_SMALL)
        y += 44
    return y


def draw_contrast_compact(draw: ImageDraw.ImageDraw, tokens: dict[str, str], x: int, y: int, title: str) -> int:
    pairs = [
        ("body/bg", "textPrimary", "background"),
        ("card", "textPrimary", "surface"),
        ("primary", "primaryText", "primaryBackground"),
        ("success", "successText", "successSurface"),
        ("info", "infoText", "infoSurface"),
        ("warning", "warningText", "warningSurface"),
    ]
    draw.text((x, y), title, fill="#16211b", font=FONT_H3)
    y += 34
    for label, fg, bg in pairs:
        ratio = contrast_ratio(tokens[fg], tokens[bg])
        ok = ratio >= 4.5
        fill = "#e8f5ec" if ok else "#fff0d8"
        outline = "#2d7a4d" if ok else "#9b5c00"
        draw.rounded_rectangle((x, y, x + 300, y + 30), radius=8, fill=fill, outline=outline, width=1)
        draw.text((x + 10, y + 7), f"{label}: {ratio:.1f}:1", fill="#16211b", font=FONT_TINY)
        y += 38
    return y


def draw_compact_swatches(
    draw: ImageDraw.ImageDraw,
    tokens: dict[str, str],
    x: int,
    y: int,
    title: str,
) -> None:
    roles = ["background", "surface", "surfaceMuted", "border", "textPrimary", "accent", "primaryBackground", "infoText"]
    draw.text((x, y), title, fill="#16211b", font=FONT_H3)
    y += 38
    for index, role in enumerate(roles):
        sx = x + (index % 4) * 82
        sy = y + (index // 4) * 64
        draw.rounded_rectangle((sx, sy, sx + 68, sy + 36), radius=8, fill=tokens[role], outline="#cfd6cf", width=1)
        draw.text((sx, sy + 40), role.replace("Background", "Bg").replace("textPrimary", "text"), fill="#415347", font=FONT_TINY)


def make_theme_previews() -> None:
    home = SCREENSHOTS_DIR / "current-home-mobile.png"
    guide = SCREENSHOTS_DIR / "current-training-guide-mobile.png"
    for direction in DIRECTIONS:
        for mode in ("light", "dark"):
            tokens = direction[mode]
            recolor_image(home, tokens, SCREENSHOTS_DIR / f"{direction['slug']}-{mode}-home-mobile.png")
            recolor_image(guide, tokens, SCREENSHOTS_DIR / f"{direction['slug']}-{mode}-guide-mobile.png")


def make_individual_board(direction: dict) -> None:
    width, height = 1600, 1260
    canvas = Image.new("RGBA", (width, height), "#f7f8f5")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, 180), fill="#ffffff")
    draw.text((64, 46), direction["name"], fill="#16211b", font=FONT_H1)
    draw.text((64, 108), direction["summary"], fill="#415347", font=FONT_BODY)

    y = 230
    draw.text((64, y), "Lecture DA", fill="#16211b", font=FONT_H2)
    y += 48
    y = draw_wrapped(draw, (64, y), direction["positioning"], "#415347", 420, FONT_BODY)
    y += 18
    y = draw_wrapped(draw, (64, y), "Points forts: " + direction["strengths"], "#16211b", 420, FONT_BODY)
    y += 18
    y = draw_wrapped(draw, (64, y), "À surveiller: " + direction["watchouts"], "#7a4d00", 420, FONT_BODY)

    draw_swatches(draw, direction["light"], 64, 660, "Palette light", columns=2)
    draw_swatches(draw, direction["dark"], 420, 660, "Palette dark", columns=2)

    previews = [
        (f"{direction['slug']}-light-home-mobile.png", "Home light"),
        (f"{direction['slug']}-light-guide-mobile.png", "Guide light"),
        (f"{direction['slug']}-dark-home-mobile.png", "Home dark"),
        (f"{direction['slug']}-dark-guide-mobile.png", "Guide dark"),
    ]
    x_positions = [770, 1035, 770, 1035]
    y_positions = [230, 230, 705, 705]
    for (filename, label), x, py in zip(previews, x_positions, y_positions):
        paste_with_frame(canvas, resize_phone(SCREENSHOTS_DIR / filename, 210), (x, py), label, draw)

    canvas.convert("RGB").save(BOARDS_DIR / f"{direction['slug']}-board.png", quality=95)


def make_comparison_board() -> None:
    width = 1800
    row_h = 700
    header_h = 820
    height = header_h + row_h * len(DIRECTIONS) + 80
    canvas = Image.new("RGBA", (width, height), "#f7f8f5")
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, width, 220), fill="#ffffff")
    draw.text((64, 48), "Fitness App - directions couleurs", fill="#16211b", font=FONT_H1)
    draw.text((64, 112), "Captures actuelles recolorisées depuis les tokens existants. Viewport mobile 390x844, plus contrôle desktop/sidebar.", fill="#415347", font=FONT_BODY)
    draw.text((64, 154), "Les previews gardent les vrais écrans, espacements, textes et composants de l’export Expo.", fill="#66756a", font=FONT_SMALL)

    draw.text((64, 260), "Référence actuelle", fill="#16211b", font=FONT_H2)
    paste_with_frame(canvas, resize_phone(SCREENSHOTS_DIR / "current-home-mobile.png", 145), (64, 315), "Home actuelle", draw)
    paste_with_frame(canvas, resize_phone(SCREENSHOTS_DIR / "current-training-guide-mobile.png", 145), (250, 315), "Guide actuel", draw)
    desktop = Image.open(SCREENSHOTS_DIR / "current-home-desktop.png").convert("RGBA")
    desktop = desktop.resize((650, round(desktop.height * 650 / desktop.width)), Image.Resampling.LANCZOS)
    paste_with_frame(canvas, desktop, (470, 315), "Sidebar desktop actuelle", draw)

    for index, direction in enumerate(DIRECTIONS):
        top = header_h + index * row_h
        draw.rounded_rectangle((40, top + 24, width - 40, top + row_h - 24), radius=24, fill="#ffffff", outline="#d8ddd8", width=1)
        draw.text((72, top + 64), direction["name"], fill="#16211b", font=FONT_H2)
        draw_wrapped(draw, (72, top + 112), direction["summary"], "#415347", 360, FONT_BODY)
        draw_wrapped(draw, (72, top + 202), direction["positioning"], "#66756a", 360, FONT_SMALL)
        draw_compact_swatches(draw, direction["light"], 72, top + 350, "Palette light")
        draw_compact_swatches(draw, direction["dark"], 72, top + 545, "Palette dark")

        preview_w = 145
        preview_y = top + 76
        previews = [
            (f"{direction['slug']}-light-home-mobile.png", "Home L"),
            (f"{direction['slug']}-light-guide-mobile.png", "Guide L"),
            (f"{direction['slug']}-dark-home-mobile.png", "Home D"),
            (f"{direction['slug']}-dark-guide-mobile.png", "Guide D"),
        ]
        for p_index, (filename, label) in enumerate(previews):
            paste_with_frame(
                canvas,
                resize_phone(SCREENSHOTS_DIR / filename, preview_w),
                (505 + p_index * 205, preview_y),
                label,
                draw,
            )

        draw_contrast_compact(draw, direction["light"], 1380, top + 76, "Contraste light")
        draw_contrast_compact(draw, direction["dark"], 1380, top + 390, "Contraste dark")

    canvas.convert("RGB").save(BOARDS_DIR / "theme-directions-comparison.png", quality=95)


def make_markdown() -> None:
    lines: list[str] = [
        "# Directions couleurs - Fitness App",
        "",
        "Source: captures réelles de l’export web Expo, générées le 26 juin 2026 depuis les écrans Login, Accueil, Test niveau, Entraînement, Guide d’exercice, Profil et Desktop/sidebar.",
        "",
        "![Planche comparative](boards/theme-directions-comparison.png)",
        "",
        "## Captures actuelles utilisées",
        "",
        "- `screenshots/current-login-mobile.png`",
        "- `screenshots/current-home-mobile.png`",
        "- `screenshots/current-level-test-mobile.png`",
        "- `screenshots/current-training-mobile.png`",
        "- `screenshots/current-training-guide-mobile.png`",
        "- `screenshots/current-profile-mobile.png`",
        "- `screenshots/current-home-desktop.png`",
        "",
    ]

    for direction in DIRECTIONS:
        lines.extend(
            [
                f"## {direction['name']}",
                "",
                f"![{direction['name']}](boards/{direction['slug']}-board.png)",
                "",
                f"- Positionnement: {direction['positioning']}",
                f"- Points forts: {direction['strengths']}",
                f"- À surveiller: {direction['watchouts']}",
                "",
                "### Tokens light",
                "",
                "| Token | Valeur |",
                "| --- | --- |",
            ]
        )
        for role in MAPPED_ROLES:
            lines.append(f"| `{role}` | `{direction['light'][role]}` |")
        lines.extend(["", "### Tokens dark", "", "| Token | Valeur |", "| --- | --- |"])
        for role in MAPPED_ROLES:
            lines.append(f"| `{role}` | `{direction['dark'][role]}` |")
        lines.extend(["", "### Contrastes clés", "", "| Pair | Light | Dark |", "| --- | ---: | ---: |"])
        contrast_pairs = [
            ("Body/background", "textPrimary", "background"),
            ("Body/card", "textPrimary", "surface"),
            ("Primary button", "primaryText", "primaryBackground"),
            ("Success badge", "successText", "successSurface"),
            ("Info badge", "infoText", "infoSurface"),
            ("Warning badge", "warningText", "warningSurface"),
            ("Danger badge", "dangerText", "dangerSurface"),
        ]
        for label, fg, bg in contrast_pairs:
            light = contrast_ratio(direction["light"][fg], direction["light"][bg])
            dark = contrast_ratio(direction["dark"][fg], direction["dark"][bg])
            lines.append(f"| {label} | {light:.1f}:1 | {dark:.1f}:1 |")
        lines.append("")

    lines.extend(
        [
            "## Recommandation",
            "",
            "Pour une première intégration, choisir **ACREA Origin** si l’objectif est de stabiliser rapidement la DA actuelle, ou **Graphite Pulse** si l’app doit prendre une posture plus premium et performance. **Terra Kinesis** est la meilleure option relationnelle/pédagogique ; **Neon Coach** doit être réservé à une app plus coachée, avec timers et guidage au centre de l’expérience.",
            "",
            "## Notes de production",
            "",
            "- Les previews sont des recolorisations de captures réelles, pas des changements de code.",
            "- Les tokens restent compatibles avec la structure actuelle `ThemeName` + `themeTokensByName`.",
            "- L’export web a nécessité `NODE_PATH` vers le store pnpm local, car `babel-preset-expo` existe dans `.pnpm` mais n’est pas lié au `node_modules` racine.",
            "",
        ]
    )
    (DA_DIR / "theme-directions.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    make_theme_previews()
    for direction in DIRECTIONS:
        make_individual_board(direction)
    make_comparison_board()
    make_markdown()


if __name__ == "__main__":
    main()
