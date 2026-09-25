"""Pasa a JPEG los lomos GENERADOS que se guardaron en PNG.

Los lomos generados llevan una textura de grano (ruido) que el PNG comprime
muy mal: unos 60 KB por lomo, 4 MB una estantería de 90 libros, y al abrir
la balda se veían llegar. En JPEG al 90% son unos 10 KB y no se distingue ni
ampliado (comparado a ×3). Desde el commit que acompaña a este script, los
nuevos ya salen en JPEG (generarLomo.js, backfill_spines.py); esto es para
los que ya existían.

Toca SOLO lomos generados (books.spine_custom = false) en .png. Por cada uno:
escribe el .jpg con un nombre nuevo, apunta el libro a él (y cualquier
referencia que hubiera a la misma imagen, que no debería haber ninguna) en
una transacción, y borra el .png viejo solo si ya no lo usa nadie. Si
mientras tanto alguien ha regenerado ese lomo, no lo pisa: deja el nuevo y
tira el .jpg que acababa de escribir.

Uso (dentro del contenedor backend, que ya tiene Pillow/psycopg2 y ve la
misma BBDD y el mismo /app/uploads que la API):

    docker-compose exec -T backend python convertir_lomos_jpeg.py --dry-run
    docker-compose exec -T backend python convertir_lomos_jpeg.py
"""
import argparse
import os
import uuid

import psycopg2
from PIL import Image

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://luni:luni@db:5432/luni")
SPINE_DIR = os.path.join(os.path.dirname(__file__), "uploads", "spines")


def ruta(url):
    return os.path.join(SPINE_DIR, os.path.basename(url))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, spine_url FROM books "
        "WHERE spine_url LIKE '/uploads/spines/%%.png' AND NOT spine_custom ORDER BY id"
    )
    libros = cur.fetchall()
    print(f"{len(libros)} lomos generados en PNG")

    hechos = sin_archivo = pisados = 0
    antes = despues = 0
    for bid, title, viejo in libros:
        origen = ruta(viejo)
        if not os.path.isfile(origen):
            sin_archivo += 1
            print(f"  #{bid} {title!r}: el PNG no está en disco, se deja como está")
            continue
        tam_antes = os.path.getsize(origen)
        if args.dry_run:
            antes += tam_antes
            print(f"  [dry-run] #{bid} {title!r} ({tam_antes // 1024} KB)")
            continue

        nuevo_nombre = f"{uuid.uuid4().hex}.jpg"
        destino = os.path.join(SPINE_DIR, nuevo_nombre)
        Image.open(origen).convert("RGB").save(destino, format="JPEG", quality=90)
        nuevo = f"/uploads/spines/{nuevo_nombre}"

        # Solo si el libro sigue con ESE lomo: si se ha regenerado entre
        # medias, el suyo es más nuevo que el que convertimos.
        cur.execute("UPDATE books SET spine_url = %s WHERE id = %s AND spine_url = %s", (nuevo, bid, viejo))
        if cur.rowcount != 1:
            conn.rollback()
            os.remove(destino)
            pisados += 1
            print(f"  #{bid} {title!r}: ha cambiado mientras tanto, no se toca")
            continue
        cur.execute("UPDATE personal_shelf SET spine_url = %s WHERE spine_url = %s", (nuevo, viejo))
        cur.execute("UPDATE book_spines SET url = %s WHERE url = %s", (nuevo, viejo))
        conn.commit()

        cur.execute(
            "SELECT (SELECT count(*) FROM books WHERE spine_url = %s)"
            " + (SELECT count(*) FROM personal_shelf WHERE spine_url = %s)"
            " + (SELECT count(*) FROM book_spines WHERE url = %s)",
            (viejo, viejo, viejo),
        )
        if cur.fetchone()[0] == 0:
            os.remove(origen)
        hechos += 1
        antes += tam_antes
        despues += os.path.getsize(destino)
        print(f"  #{bid} {title!r}: {tam_antes // 1024} KB -> {os.path.getsize(destino) // 1024} KB")

    if args.dry_run:
        print(f"\n[dry-run] se convertirían {len(libros) - sin_archivo} ({antes // 1024} KB en PNG); "
              f"{sin_archivo} sin archivo en disco")
    else:
        print(f"\nConvertidos {hechos}: {antes // 1024} KB -> {despues // 1024} KB. "
              f"Sin archivo: {sin_archivo}. Cambiados mientras tanto: {pisados}.")
    conn.close()


if __name__ == "__main__":
    main()
