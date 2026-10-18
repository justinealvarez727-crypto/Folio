"""Generate PWA PNG icons (run once; outputs are committed in /public).

    python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw

ACCENT = (94, 106, 210, 255)


def draw(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=ACCENT)  # full-bleed for maskable
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=ACCENT)
    # Open-book glyph, scaled inside the 80% safe zone for maskable icons.
    s = size * (0.62 if maskable else 0.74)
    ox = (size - s) / 2
    oy = (size - s) / 2

    def p(x, y):
        return (ox + x * s, oy + y * s)

    left = [p(0.5, 0.05), p(0.5, 0.95), p(0.12, 0.8), p(0.12, 0.15)]
    right = [p(0.5, 0.05), p(0.88, 0.15), p(0.88, 0.8), p(0.5, 0.95)]
    d.polygon(left, fill=(255, 255, 255, 235))
    d.polygon(right, fill=(255, 255, 255, 140))
    return img


for name, size, maskable in [
    ("pwa-192.png", 192, False),
    ("pwa-512.png", 512, False),
    ("pwa-maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, True),
]:
    draw(size, maskable).save(f"public/{name}")
    print("wrote", name)
