import json
import asyncio
from fastapi import WebSocket
from typing import Optional


class ConnectionManager:
    def __init__(self):
        self._conns: dict[int, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, player_id: int, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            # Si ya hay una conexión para este player, ciérrala
            old = self._conns.get(player_id)
            if old:
                try:
                    await old.close()
                except Exception:
                    pass
            self._conns[player_id] = ws

    async def disconnect(self, player_id: int, ws: WebSocket):
        async with self._lock:
            # Solo eliminar si la conexión registrada es la que se está cerrando
            if self._conns.get(player_id) is ws:
                self._conns.pop(player_id, None)

    @property
    def online_ids(self) -> list[int]:
        return list(self._conns.keys())

    async def broadcast(self, data: dict, exclude: Optional[int] = None):
        text = json.dumps(data, default=str)
        # Snapshot para evitar RuntimeError al modificar el dict durante la iteración
        async with self._lock:
            snapshot = list(self._conns.items())
        for pid, ws in snapshot:
            if pid == exclude:
                continue
            try:
                await ws.send_text(text)
            except Exception:
                async with self._lock:
                    if self._conns.get(pid) is ws:
                        self._conns.pop(pid, None)

    async def send_to_players(self, player_ids: list[int], data: dict):
        text = json.dumps(data, default=str)
        async with self._lock:
            snapshot = [(pid, self._conns[pid]) for pid in player_ids if pid in self._conns]
        for pid, ws in snapshot:
            try:
                await ws.send_text(text)
            except Exception:
                async with self._lock:
                    if self._conns.get(pid) is ws:
                        self._conns.pop(pid, None)

    async def kick(self, player_id: int):
        """Cierra la conexión de un jugador si la tiene abierta ahora mismo —
        para cuando el admin lo desactiva o lo borra y tiene que perder el
        acceso al instante, no la próxima vez que recargue. El cierre dispara
        solo la limpieza normal (finally del websocket_endpoint), no hace
        falta hacer nada más aquí."""
        async with self._lock:
            ws = self._conns.get(player_id)
        if ws:
            try:
                await ws.close(code=4001)
            except Exception:
                pass


manager = ConnectionManager()
