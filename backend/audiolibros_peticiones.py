"""Audiolibros, peticiones de los usuarios (fase 6, issue #68 de puchi).

Cualquiera puede pedir que se prepare el audiolibro de un libro que tenga en
su estantería. Lo que se guarda es solo eso, quién pide qué libro, y si el
admin lo rechazó. Todo lo demás sale de lo que ya hay:

- Si el libro está enlazado con un audiolibro, la petición va tan avanzada como
  ese audiolibro (preparándose, en cola, generándose, escuchable). No hace
  falta marcarla como atendida: lo está en cuanto el admin enlaza el libro.
- Las peticiones de una misma novela dada de alta como libros distintos ("El
  nombre del viento" y "El nombre del viento (Crónica del asesino de reyes
  1)") se juntan en una sola para el admin, con todos los interesados.

Una petición deja de contar si quien la hizo quita el libro de su estantería.
"""
import difflib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from auth import get_current_player, require_admin
from audiolibros import _ahora, _enlaces, _estado, _isbn, _iso, _normal, _resumen, _titulo_base
from database import (
    Audiobook, AudiobookBook, AudiobookChapter, AudiobookRequest, Book, PersonalShelf, Player, get_db,
)

router = APIRouter(prefix="/audiobook-requests", tags=["audiolibros"])


# ─── ¿Es la misma novela? ────────────────────────────────────────────────────

def _titulos(*ts: Optional[str]) -> set[str]:
    return {b for b in (_titulo_base(t) for t in ts) if b}


def _mismo_libro(titulos_a: set[str], autor_a: Optional[str], isbn_a: Optional[str],
                 titulos_b: set[str], autor_b: Optional[str], isbn_b: Optional[str]) -> bool:
    """Con los mismos criterios que las sugerencias de enlace del admin: el
    ISBN manda; si no, título parecido y que el autor no lo desmienta."""
    if isbn_a and isbn_a == isbn_b:
        return True
    parecido = any(
        (a == b or ((a in b or b in a) and min(len(a), len(b)) >= 4))
        or difflib.SequenceMatcher(None, a, b).ratio() >= 0.9
        for a in titulos_a for b in titulos_b
    )
    if not parecido:
        return False
    aa, ab = set(_normal(autor_a).split()), set(_normal(autor_b).split())
    return not aa or not ab or bool(aa & ab)


def _juntar(libros: list[Book]) -> list[list[Book]]:
    """Agrupa los libros que son la misma novela. Unos pocos cientos como
    mucho: compararlos todos con todos es instantáneo."""
    datos = [(b, _titulos(b.title, b.original_title), b.author, _isbn(b.isbn)) for b in libros]
    padre = list(range(len(datos)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    for i in range(len(datos)):
        for j in range(i + 1, len(datos)):
            if _mismo_libro(*datos[i][1:], *datos[j][1:]):
                padre[raiz(i)] = raiz(j)
    grupos: dict[int, list[Book]] = {}
    for i, (b, *_r) in enumerate(datos):
        grupos.setdefault(raiz(i), []).append(b)
    return list(grupos.values())


# ─── Lo que cuenta ───────────────────────────────────────────────────────────

def _vigentes(db: Session, book_ids: Optional[list[int]] = None):
    """(petición, quién, libro) de las peticiones que siguen en pie: de
    cuentas aprobadas y con el libro todavía en su estantería."""
    q = (db.query(AudiobookRequest, Player, Book)
         .join(Player, Player.id == AudiobookRequest.player_id)
         .join(Book, Book.id == AudiobookRequest.book_id)
         .join(PersonalShelf, and_(PersonalShelf.player_id == AudiobookRequest.player_id,
                                   PersonalShelf.book_id == AudiobookRequest.book_id))
         .filter(Player.status == "approved"))
    if book_ids is not None:
        q = q.filter(AudiobookRequest.book_id.in_(book_ids))
    return q.order_by(AudiobookRequest.created_at).all()


def _jugador(p: Player) -> dict:
    return {"id": p.id, "name": p.name, "color": p.color,
            "avatar_url": p.avatar_url, "avatar_emoji": p.avatar_emoji}


def _estado_audiolibro(db: Session, ab_id: int) -> tuple[str, int]:
    caps = (db.query(AudiobookChapter.status, AudiobookChapter.audio_path)
            .filter(AudiobookChapter.audiobook_id == ab_id, AudiobookChapter.included.is_(True)).all())
    listos = sum(1 for c in caps if c.status == "listo" and c.audio_path)
    return _estado(caps), listos


def _para_quien_pide(estado: str, listos: int) -> str:
    """Lo que ve quien lo pidió. No le hace falta el detalle del admin
    (pausado, error): para él se está preparando hasta que suena."""
    if listos:
        return "escuchable"
    if estado in ("en_cola", "generando"):
        return estado
    return "preparando"


# ─── Quien pide ──────────────────────────────────────────────────────────────

def _de_un_libro(db: Session, book_id: int, p: Player) -> dict:
    tiene = (db.query(PersonalShelf.id)
             .filter(PersonalShelf.player_id == p.id, PersonalShelf.book_id == book_id).first())
    mia = (db.query(AudiobookRequest)
           .filter(AudiobookRequest.player_id == p.id, AudiobookRequest.book_id == book_id).first())
    enlace = db.query(AudiobookBook).filter(AudiobookBook.book_id == book_id).first()
    out = {"can_request": False, "requested": bool(mia), "status": None,
           "requested_at": _iso(mia.created_at) if mia else None, "reason": None, "others": 0}
    if not tiene:
        return out
    if enlace:
        if mia:
            out["status"] = _para_quien_pide(*_estado_audiolibro(db, enlace.audiobook_id))
        return out
    if mia and mia.rejected_at:
        out["status"], out["reason"] = "rechazado", mia.reject_reason
        return out
    out["status"] = "pedido" if mia else None
    out["can_request"] = not mia
    # Cuántos más lo esperan: lo anima a pedirlo, y a quien ya lo pidió le
    # dice que no es el único.
    libro = db.query(Book).filter(Book.id == book_id).first()
    yo = (_titulos(libro.title, libro.original_title), libro.author, _isbn(libro.isbn))
    otros = {pl.id for r, pl, b in _vigentes(db)
             if pl.id != p.id and not r.rejected_at
             and not db.query(AudiobookBook.id).filter(AudiobookBook.book_id == b.id).first()
             and (b.id == book_id or _mismo_libro(*yo, _titulos(b.title, b.original_title), b.author, _isbn(b.isbn)))}
    out["others"] = len(otros)
    return out


@router.get("/book/{book_id}")
def ver_mia(book_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    return _de_un_libro(db, book_id, p)


@router.post("/book/{book_id}")
def pedir(book_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    if not (db.query(PersonalShelf.id)
            .filter(PersonalShelf.player_id == p.id, PersonalShelf.book_id == book_id).first()):
        raise HTTPException(status_code=403, detail="Solo se pueden pedir libros de tu estantería")
    if db.query(AudiobookBook.id).filter(AudiobookBook.book_id == book_id).first():
        raise HTTPException(status_code=409, detail="Este libro ya tiene audiolibro")
    if not (db.query(AudiobookRequest.id)
            .filter(AudiobookRequest.player_id == p.id, AudiobookRequest.book_id == book_id).first()):
        db.add(AudiobookRequest(player_id=p.id, book_id=book_id))
        db.commit()
    return _de_un_libro(db, book_id, p)


@router.delete("/book/{book_id}")
def anular(book_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    """Echarse atrás mientras sigue pedida. Una rechazada se queda como está
    (si no, borrarla y volver a pedirla la sacaría otra vez como nueva), y
    una que ya va con un audiolibro no tiene nada que anular."""
    mia = (db.query(AudiobookRequest)
           .filter(AudiobookRequest.player_id == p.id, AudiobookRequest.book_id == book_id).first())
    if mia:
        if mia.rejected_at:
            raise HTTPException(status_code=409, detail="Esta petición ya está rechazada")
        if db.query(AudiobookBook.id).filter(AudiobookBook.book_id == book_id).first():
            raise HTTPException(status_code=409, detail="Este libro ya tiene audiolibro")
        db.delete(mia)
        db.commit()
    return _de_un_libro(db, book_id, p)


# ─── El admin ────────────────────────────────────────────────────────────────

def _fila(r: AudiobookRequest, pl: Player) -> dict:
    return {"id": r.id, "book_id": r.book_id, "player": _jugador(pl), "created_at": _iso(r.created_at),
            "rejected_at": _iso(r.rejected_at), "reason": r.reject_reason}


def _libro(b: Book) -> dict:
    return {"id": b.id, "title": b.title, "author": b.author, "cover_url": b.cover_url, "year": b.year}


def _sugerencia(audiolibros: list[Audiobook], libros: list[Book]) -> Optional[dict]:
    """Un audiolibro que ya existe y parece esta misma novela: enlazar es un
    toque, en vez de volver a subir el EPUB."""
    for ab in audiolibros:
        suyo = (_titulos(ab.title), ab.author, _isbn(ab.isbn))
        if any(_mismo_libro(*suyo, _titulos(b.title, b.original_title), b.author, _isbn(b.isbn)) for b in libros):
            return {"id": ab.id, "title": ab.title, "author": ab.author}
    return None


@router.get("")
def bandeja(db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Las peticiones, juntas por novela. Primero las que hay que atender."""
    filas = _vigentes(db)
    if not filas:
        return []
    enlazados = {b: a for b, a in db.query(AudiobookBook.book_id, AudiobookBook.audiobook_id)
                 .filter(AudiobookBook.book_id.in_({b.id for _r, _p, b in filas})).all()}

    por_libro: dict[int, list] = {}
    libros: dict[int, Book] = {}
    for r, pl, b in filas:
        por_libro.setdefault(b.id, []).append(_fila(r, pl))
        libros[b.id] = b

    grupos = []
    # Las que ya van con un audiolibro: una por audiolibro.
    por_ab: dict[int, list[int]] = {}
    for bid, ab_id in enlazados.items():
        por_ab.setdefault(ab_id, []).append(bid)
    if por_ab:
        abs_ = {a.id: a for a in db.query(Audiobook).filter(Audiobook.id.in_(por_ab)).all()}
        caps: dict[int, list] = {}
        for c in (db.query(AudiobookChapter.audiobook_id, AudiobookChapter.words, AudiobookChapter.included,
                           AudiobookChapter.status, AudiobookChapter.duration_s)
                  .filter(AudiobookChapter.audiobook_id.in_(por_ab)).all()):
            caps.setdefault(c.audiobook_id, []).append(c)
        enlaces = _enlaces(db, list(por_ab))
        for ab_id, bids in por_ab.items():
            ab = abs_[ab_id]
            resumen = _resumen(ab, caps.get(ab_id, []), enlaces.get(ab_id, []))
            grupos.append({
                "key": f"a{ab_id}", "state": resumen["status"],
                "title": ab.title, "author": ab.author, "cover_url": resumen["cover_url"],
                "books": [_libro(libros[i]) for i in bids],
                "requests": [x for i in bids for x in por_libro[i]],
                "audiobook": {k: resumen[k] for k in ("id", "title", "status", "chapters_ready", "chapters_included")},
                "suggestion": None,
            })

    # Las que no: juntas por novela.
    sueltos = [libros[i] for i in libros if i not in enlazados]
    todos_abs = db.query(Audiobook).order_by(Audiobook.created_at.desc()).all()
    for grupo in _juntar(sueltos):
        peticiones = [x for b in grupo for x in por_libro[b.id]]
        pendientes = [x for x in peticiones if not x["rejected_at"]]
        # El que más gente pidió da el título y la portada.
        grupo.sort(key=lambda b: -len(por_libro[b.id]))
        cabeza = grupo[0]
        grupos.append({
            "key": "b" + "-".join(str(b.id) for b in sorted(grupo, key=lambda b: b.id)),
            "state": "pendiente" if pendientes else "rechazada",
            "title": cabeza.title, "author": cabeza.author,
            "cover_url": next((b.cover_url for b in grupo if b.cover_url), None),
            "books": [_libro(b) for b in grupo],
            "requests": peticiones,
            "audiobook": None,
            "suggestion": _sugerencia(todos_abs, grupo) if pendientes else None,
            "reason": next((x["reason"] for x in peticiones if x["reason"]), None),
        })

    orden = {"pendiente": 0, "borrador": 1, "pausado": 1, "error": 1, "en_cola": 1, "generando": 1,
             "listo": 3, "rechazada": 4}
    for g in grupos:
        g["players"] = len({x["player"]["id"] for x in g["requests"]})
        g["first_at"] = min(x["created_at"] for x in g["requests"])
        g["last_at"] = max(x["created_at"] for x in g["requests"])
    # Por atender: las más pedidas primero y, a igualdad, la más antigua.
    grupos.sort(key=lambda g: (orden.get(g["state"], 2), -g["players"] if g["state"] == "pendiente" else 0,
                               g["first_at"] if g["state"] == "pendiente" else "",
                               "" if g["state"] == "pendiente" else g["last_at"]))
    # Lo atendido y lo rechazado, de lo más reciente a lo más viejo.
    hechos = [g for g in grupos if g["state"] in ("listo", "rechazada")]
    hechos.sort(key=lambda g: g["last_at"], reverse=True)
    return [g for g in grupos if g not in hechos] + hechos


class Rechazo(BaseModel):
    book_ids: list[int]
    reason: Optional[str] = None


@router.post("/reject")
def rechazar(cuerpo: Rechazo, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Rechaza a la vez todas las peticiones de esos libros: es la misma
    novela, y a todos se les da el mismo motivo."""
    motivo = (cuerpo.reason or "").strip()[:300] or None
    ahora = _ahora()
    for r in (db.query(AudiobookRequest)
              .filter(AudiobookRequest.book_id.in_(cuerpo.book_ids), AudiobookRequest.rejected_at.is_(None)).all()):
        r.rejected_at, r.reject_reason = ahora, motivo
    db.commit()
    return bandeja(db)


@router.post("/unreject")
def deshacer_rechazo(cuerpo: Rechazo, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    for r in db.query(AudiobookRequest).filter(AudiobookRequest.book_id.in_(cuerpo.book_ids)).all():
        r.rejected_at = r.reject_reason = None
    db.commit()
    return bandeja(db)


def pedido_por(db: Session, book_ids: list[int]) -> set[int]:
    """Quién pidió alguno de estos libros (para la ficha del audiolibro)."""
    if not book_ids:
        return set()
    return {pid for (pid,) in db.query(AudiobookRequest.player_id)
            .filter(AudiobookRequest.book_id.in_(book_ids)).all()}
