"""Genera el lomo de los libros que se quedaron sin él antes de que existiera
generarLomo.js (commit d7225dc, 2026-09-19), replicando la MISMA cuenta que
ese archivo (dibujar en un <canvas>) y que Lomos.jsx (capasDeFondo) usan en
el navegador — pero en Pillow, para poder correrlo una vez como script de
servidor sin pasar por un navegador.

Toca SOLO books.spine_url y books.spine_custom, y SOLO en libros donde
spine_url es NULL — nunca sobrescribe uno que ya exista (generado o subido a
mano), y nunca toca título, autor, año, páginas, alto ni nada de la copia
personal de nadie. Es exactamente lo que ya hace POST /books/{id}/spine
cuando lo llama generarLomo.js, aplicado una vez a los que se quedaron atrás.

Uso (dentro del contenedor backend, que ya tiene Pillow/psycopg2 y ve la
misma BBDD y el mismo /app/uploads que la API):

    docker-compose exec backend python backfill_spines.py --dry-run
    docker-compose exec backend python backfill_spines.py

--dry-run: no escribe nada, solo dice a cuántos libros afectaría y por qué
se salta los demás (sin portada, portada no legible, etc).
"""
import argparse
import colorsys
import io
import math
import os
import random
import uuid

import psycopg2
from PIL import Image, ImageDraw

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://luni:luni@db:5432/luni")
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
SPINE_DIR = os.path.join(UPLOADS_DIR, "spines")
os.makedirs(SPINE_DIR, exist_ok=True)

# ─── Medidas (medidas() de Lomos.jsx) ───────────────────────────────────────
ALTO_MIN, ALTO_MAX = 134, 180
ANCHO_MIN, ANCHO_MAX = 26, 56
MM_MIN, MM_MAX = 170, 250
FRANJA = 0.04          # el 4% izquierdo de la portada, igual que Lomos.jsx
ESCALA = 2              # ×2 para pantallas retina, igual que generarLomo.js


def to_int32(x):
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x


def huella(texto):
    h = 0
    for ch in texto:
        h = to_int32(h * 31 + ord(ch))
    return abs(h)


def color_de_lomo(h):
    """Mismo cálculo que colorDeLomo() en Lomos.jsx, en RGB 0-255."""
    tono = h % 360
    sat = 22 + (h % 18)
    luz = 28 + ((h // 7) % 14)
    r, g, b = colorsys.hls_to_rgb(tono / 360, luz / 100, sat / 100)
    return (round(r * 255), round(g * 255), round(b * 255))


def alto_desde_mm(mm):
    topado = min(MM_MAX, max(MM_MIN, mm))
    return round(ALTO_MIN + (topado - MM_MIN) / (MM_MAX - MM_MIN) * (ALTO_MAX - ALTO_MIN))


def medidas(title, author, height_mm, num_pages):
    h = huella(f"{title}·{author or ''}")
    paginas = num_pages
    ancho = (ANCHO_MIN + min(paginas, 1000) / 1000 * (ANCHO_MAX - ANCHO_MIN)) if paginas \
        else (ANCHO_MIN + (h % 100) / 100 * (ANCHO_MAX - ANCHO_MIN))
    alto = alto_desde_mm(height_mm) if height_mm \
        else (ALTO_MIN + (h % 100) / 100 * (ALTO_MAX - ALTO_MIN))
    tapa_dura = (paginas or 0) >= 500
    return {
        "ancho": round(ancho), "alto": round(alto),
        "color": color_de_lomo(h), "tapa_dura": tapa_dura,
    }


# ─── Color de la portada (colorDePortada() de colorPortada.js) ─────────────
def color_de_portada(cover_path):
    """Devuelve (color_rgb, luz_original_0_100) o (None, None) si no se puede
    leer la portada (mismo criterio que el original: sin ella, el lomo se
    queda con su color de reserva)."""
    if not cover_path or not os.path.isfile(cover_path):
        return None, None
    try:
        img = Image.open(cover_path).convert("RGBA")
    except Exception:
        return None, None
    w, h = img.size
    franja_ancho = max(1, round(w * 0.14))
    franja = img.crop((0, 0, franja_ancho, h)).resize((4, 16), Image.LANCZOS)
    r = g = b = peso = 0.0
    for px in franja.getdata():
        pr, pg, pb, pa = px
        alfa = pa / 255
        if alfa < 0.06:
            continue
        mx, mn = max(pr, pg, pb), min(pr, pg, pb)
        p = (0.25 + (mx - mn) / 255) * alfa
        r += pr * p; g += pg * p; b += pb * p; peso += p
    if not peso:
        return None, None
    hh, ll, ss = colorsys.rgb_to_hls(r / peso / 255, g / peso / 255, b / peso / 255)
    hh, ss, ll = hh * 360, ss * 100, ll * 100
    color_s = min(max(ss, 18), 55)
    color_l = min(max(ll, 24), 46)
    cr, cg, cb = colorsys.hls_to_rgb(hh / 360, color_l / 100, color_s / 100)
    return (round(cr * 255), round(cg * 255), round(cb * 255)), round(ll)


# ─── Dibujo del lomo (dibujar() de generarLomo.js) ──────────────────────────
def _grad_horizontal(w, h, stops):
    """stops: [(pos0-1, (r,g,b,a0-1)), ...]. Una fila interpolada, estirada
    a lo alto — igual que un linear-gradient(to right, ...) de CSS/canvas."""
    fila = Image.new("RGBA", (w, 1))
    px = fila.load()
    for x in range(w):
        t = x / max(1, w - 1)
        i = 0
        while i < len(stops) - 2 and t > stops[i + 1][0]:
            i += 1
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        frac = 0 if p1 == p0 else (t - p0) / (p1 - p0)
        frac = min(1, max(0, frac))
        col = tuple(round(c0[k] + (c1[k] - c0[k]) * frac) for k in range(4))
        px[x, 0] = col
    return fila.resize((w, h), Image.NEAREST)


def _grad_vertical(w, h, c0, c1):
    col = Image.new("RGBA", (1, h))
    px = col.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(c0[k] + (c1[k] - c0[k]) * t) for k in range(4))
        px[0, y] = c
    return col.resize((w, h), Image.NEAREST)


def _solido(w, h, rgba):
    return Image.new("RGBA", (w, h), rgba)


def _overlay_ruido(base, opacidad=0.108, semilla=None):
    """Aproximación del grano de TEXTURA_LOMO: la SVG feTurbulence original
    no se puede reproducir pixel a pixel fuera de un navegador, así que esto
    es ruido aleatorio de baja amplitud con blend 'overlay' — mismo efecto
    visual (un grano sutil), no el mismo patrón exacto. A este tamaño de
    lomo (26-56px) no se distingue a simple vista."""
    rnd = random.Random(semilla)
    w, h = base.size
    ruido = Image.new("L", (w, h))
    px = ruido.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = round(128 + rnd.uniform(-1, 1) * 128 * opacidad)
    base_rgb = base.convert("RGB")
    out = Image.new("RGB", (w, h))
    bpx, rpx, opx = base_rgb.load(), ruido.load(), out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = bpx[x, y]
            n = rpx[x, y] / 255
            def ov(c):
                c /= 255
                res = (2 * c * n) if c < 0.5 else (1 - 2 * (1 - c) * (1 - n))
                return round(min(1, max(0, res)) * 255)
            opx[x, y] = (ov(r), ov(g), ov(b))
    return out


def dibujar_lomo(medida, cover_path, paleta_color, claro):
    ancho, alto = medida["ancho"] * ESCALA, medida["alto"] * ESCALA
    lienzo = Image.new("RGBA", (ancho, alto), (0, 0, 0, 0))

    color_base = paleta_color or medida["color"]
    lienzo.alpha_composite(_solido(ancho, alto, color_base + (255,)))

    if cover_path:
        try:
            cov = Image.open(cover_path).convert("RGBA")
            cw, ch = cov.size
            franja = cov.crop((0, 0, max(1, round(cw * FRANJA)), ch)).resize((ancho, alto), Image.LANCZOS)
            lienzo.alpha_composite(franja)
        except Exception:
            pass
        if paleta_color:
            lienzo.alpha_composite(_solido(ancho, alto, paleta_color + (round(255 * 0.45),)))
        velo = (255, 255, 255, round(255 * 0.25)) if claro else (0, 0, 0, round(255 * 0.2))
        lienzo.alpha_composite(_solido(ancho, alto, velo))

    volumen = _grad_horizontal(ancho, alto, [
        (0.00, (0, 0, 0, round(255 * 0.35))),
        (0.28, (255, 255, 255, round(255 * 0.10))),
        (0.62, (0, 0, 0, round(255 * 0.10))),
        (1.00, (0, 0, 0, round(255 * 0.32))),
    ])
    lienzo.alpha_composite(volumen)

    for i, y in enumerate([6, 9, medida["alto"] - 10, medida["alto"] - 7]):
        y *= ESCALA
        color = (255, 255, 255, round(255 * (0.14 if i % 2 else 0.3)))
        lienzo.alpha_composite(_solido(ancho, ESCALA, color), (0, y))

    if medida["tapa_dura"]:
        for arriba in (True, False):
            y = (1 if arriba else medida["alto"] - 3) * ESCALA
            cinta = Image.new("RGBA", (ancho - 2 * ESCALA, 2 * ESCALA))
            cpx = cinta.load()
            for x in range(cinta.width):
                c = (238, 226, 205, round(255 * 0.209)) if (x // ESCALA) % 2 == 0 else (155, 115, 90, round(255 * 0.171))
                for yy in range(cinta.height):
                    cpx[x, yy] = c
            lienzo.alpha_composite(cinta, (ESCALA, y))
        for p in (0.34, 0.5, 0.66):
            y = round(p * medida["alto"]) * ESCALA
            banda = _grad_vertical(ancho, 4 * ESCALA, (255, 255, 255, round(255 * 0.16)), (0, 0, 0, round(255 * 0.28)))
            lienzo.alpha_composite(banda, (0, y))

    rgb = _overlay_ruido(lienzo, semilla=medida["ancho"] * 10000 + medida["alto"])
    return rgb


# ─── Programa principal ─────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("""
        select id, title, author, cover_url, height_mm, num_pages
        from books
        where cover_url is not null and spine_url is null
        order by id
        %s
    """ % ("limit %d" % args.limit if args.limit else ""))
    filas = cur.fetchall()
    print(f"{len(filas)} libros sin lomo y con portada.")

    hechos, saltados = 0, 0
    for bid, title, author, cover_url, height_mm, num_pages in filas:
        cover_path = None
        if cover_url and cover_url.startswith("/uploads/"):
            cover_path = os.path.join(UPLOADS_DIR, cover_url[len("/uploads/"):])
            if not os.path.isfile(cover_path):
                cover_path = None

        medida = medidas(title, author, height_mm, num_pages)
        paleta_color, luz = color_de_portada(cover_path) if cover_path else (None, None)
        claro = luz is not None and luz >= 58

        if not cover_path:
            print(f"  #{bid} {title!r}: portada no accesible en disco ({cover_url}), "
                  f"se genera igual con color de reserva.")

        if args.dry_run:
            print(f"  [dry-run] #{bid} {title!r} -> {medida['ancho']}x{medida['alto']}px, "
                  f"paleta={'sí' if paleta_color else 'no'}")
            continue

        img = dibujar_lomo(medida, cover_path, paleta_color, claro)
        buf = io.BytesIO()
        # JPEG al 90%, igual que generarLomo.js: el grano de textura hace que
        # el PNG pese seis veces más sin verse mejor.
        img.convert("RGB").save(buf, format="JPEG", quality=90)
        filename = f"{uuid.uuid4().hex}.jpg"
        with open(os.path.join(SPINE_DIR, filename), "wb") as f:
            f.write(buf.getvalue())
        url = f"/uploads/spines/{filename}"

        cur.execute(
            "update books set spine_url = %s, spine_custom = false "
            "where id = %s and spine_url is null",
            (url, bid),
        )
        if cur.rowcount == 1:
            conn.commit()
            hechos += 1
            print(f"  #{bid} {title!r}: OK -> {url}")
        else:
            # Alguien lo generó entre el SELECT y aquí (edición en vivo,
            # otra ejecución a la vez): no se pisa, se descarta el archivo.
            conn.rollback()
            os.remove(os.path.join(SPINE_DIR, filename))
            saltados += 1
            print(f"  #{bid} {title!r}: ya tenía lomo (generado mientras tanto), se salta.")

    cur.close()
    conn.close()
    if not args.dry_run:
        print(f"\nHecho: {hechos} generados, {saltados} saltados de {len(filas)}.")


if __name__ == "__main__":
    main()
