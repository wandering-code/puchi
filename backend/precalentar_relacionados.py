"""Deja calculadas de antemano las sugerencias (saga y más del autor, issue
#7) de todos los libros que están en alguna estantería, para que nadie tenga
que esperar los 2-4 s de la primera vez al abrir su ficha.

Solo escribe en la tabla related_cache (la caché de sugerencias, que se
puede borrar entera sin perder nada: se vuelve a calcular sola). Lo único que
puede tocar de un libro es books.original_title, y solo si está vacío — igual
que ya hace abrir su ficha desde la app. Nunca toca título, autor, portada ni
nada de la estantería de nadie.

Va despacio a propósito (un libro cada --pausa segundos, 4 por defecto): la
cadena pregunta a Open Library, Wikidata y Google Books, y Open Library ya
nos bloqueó una vez por ir deprisa. Se puede cortar y relanzar cuando sea:
se salta los libros que ya tienen sus sugerencias guardadas.

Uso (dentro del contenedor backend, desde /home/wander/apps/puchi):

    docker-compose exec -T backend python precalentar_relacionados.py --dry-run
    docker-compose exec -T backend python precalentar_relacionados.py
"""
import argparse
import asyncio

from database import SessionLocal, Book, PersonalShelf, RelatedCache
from main import _compute_related_raw, _related_signature


def pendientes() -> list[tuple[int, str]]:
    db = SessionLocal()
    try:
        en_estanteria = {b for (b,) in db.query(PersonalShelf.book_id).distinct()}
        guardadas = {r.book_id: r.signature for r in db.query(RelatedCache).all()}
        libros = db.query(Book).filter(Book.id.in_(en_estanteria)).order_by(Book.id).all() if en_estanteria else []
        return [(b.id, b.title) for b in libros if guardadas.get(b.id) != _related_signature(b)[0]]
    finally:
        db.close()


async def main(dry_run: bool, pausa: float):
    lista = pendientes()
    print(f"{len(lista)} libros sin sugerencias guardadas")
    if dry_run:
        for book_id, title in lista:
            print(f"  {book_id}  {title}")
        return
    for i, (book_id, title) in enumerate(lista, 1):
        raw = await _compute_related_raw(book_id)
        sagas = sum(len(g["books"]) for g in (raw or {}).get("series", []))
        autor = len((raw or {}).get("same_author", []))
        print(f"[{i}/{len(lista)}] {book_id} {title}: saga {sagas}, autor {autor}", flush=True)
        await asyncio.sleep(pausa)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--pausa", type=float, default=4.0)
    args = parser.parse_args()
    asyncio.run(main(args.dry_run, args.pausa))
