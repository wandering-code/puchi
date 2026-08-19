"""Descarga en local las portadas externas (Open Library u otra fuente) de
libros y entradas de estantería que ya existían antes de que el alta/edición
empezara a cachearlas sola (ver _cache_cover_url en main.py) — para que
también ellas dejen de depender de un tercero en cada carga de Luniteca.

Solo cambia el valor de `cover_url` a la ruta local ya cacheada; si una
descarga en concreto falla, esa fila se deja tal cual, sin tocar nada más.
No borra ninguna fila ni ningún fichero. Idempotente: se puede volver a
ejecutar sin problema, las portadas que ya estén cacheadas se saltan al
instante (sin red) y las que fallaron la vez anterior simplemente se
reintentan.

Uso (dentro del contenedor del backend, o con el venv activo en local):
    python backfill_cover_cache.py
"""
import asyncio

from database import SessionLocal, Book, PersonalShelf
from main import _cache_cover_url


async def _backfill(label: str, rows: list, get_url, set_url) -> None:
    print(f"{label}: {len(rows)} con portada externa")
    for i, row in enumerate(rows, 1):
        old_url = get_url(row)
        new_url = await _cache_cover_url(old_url)
        if new_url != old_url:
            set_url(row, new_url)
            print(f"  [{i}/{len(rows)}] cacheada — {new_url}")
        else:
            print(f"  [{i}/{len(rows)}] sin cambios (fallo de descarga, se deja la URL externa)")


async def main() -> None:
    db = SessionLocal()
    try:
        books = db.query(Book).filter(Book.cover_url.like("http%")).all()
        await _backfill(
            "Libros", books,
            get_url=lambda b: b.cover_url,
            set_url=lambda b, url: setattr(b, "cover_url", url),
        )
        db.commit()

        entries = db.query(PersonalShelf).filter(PersonalShelf.cover_url.like("http%")).all()
        await _backfill(
            "Entradas de estantería personal (portada propia)", entries,
            get_url=lambda e: e.cover_url,
            set_url=lambda e, url: setattr(e, "cover_url", url),
        )
        db.commit()
    finally:
        db.close()
    print("Listo.")


if __name__ == "__main__":
    asyncio.run(main())
