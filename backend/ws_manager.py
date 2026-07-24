import json
import asyncio
from fastapi import WebSocket
from typing import Optional


class ConnectionManager:
    """Varias conexiones por jugador (una por dispositivo/pestaña), no una
    sola — antes, conectar desde un segundo dispositivo cerraba la conexión
    del primero sin más, y con ella se perdía en el acto el canal de
    señalización de cualquier llamada 1-a-1 que tuviera en marcha. Ahora cada
    dispositivo se identifica con un `device_id` propio (generado y
    persistido en el propio navegador) y conviven todos los que hagan falta;
    solo se cierra la conexión anterior de ESE MISMO dispositivo (una
    pestaña que recarga), nunca las de otros dispositivos del mismo jugador."""

    def __init__(self):
        self._conns: dict[int, dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, player_id: int, device_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            devices = self._conns.setdefault(player_id, {})
            # Si este mismo dispositivo ya tenía una conexión (pestaña
            # recargada sin cierre limpio), esa sí se cierra — las de otros
            # dispositivos del mismo jugador se quedan intactas.
            old = devices.get(device_id)
            if old:
                try:
                    await old.close()
                except Exception:
                    pass
            devices[device_id] = ws

    async def disconnect(self, player_id: int, device_id: str, ws: WebSocket):
        async with self._lock:
            devices = self._conns.get(player_id)
            if devices and devices.get(device_id) is ws:
                devices.pop(device_id, None)
                if not devices:
                    self._conns.pop(player_id, None)

    @property
    def online_ids(self) -> list[int]:
        return list(self._conns.keys())

    async def broadcast(self, data: dict, exclude: Optional[int] = None):
        text = json.dumps(data, default=str)
        async with self._lock:
            snapshot = [(pid, dev, ws) for pid, devices in self._conns.items() for dev, ws in devices.items()]
        for pid, dev, ws in snapshot:
            if pid == exclude:
                continue
            try:
                await ws.send_text(text)
            except Exception:
                await self._drop(pid, dev, ws)

    async def send_to_players(self, player_ids: list[int], data: dict):
        """Manda a TODOS los dispositivos conectados de cada jugador de la
        lista — lo correcto para presencia/chat/avisos de perfil, donde
        todas las pestañas/dispositivos abiertos deben enterarse igual."""
        text = json.dumps(data, default=str)
        async with self._lock:
            snapshot = [
                (pid, dev, ws)
                for pid in player_ids
                for dev, ws in self._conns.get(pid, {}).items()
            ]
        for pid, dev, ws in snapshot:
            try:
                await ws.send_text(text)
            except Exception:
                await self._drop(pid, dev, ws)

    async def send_to_device(self, player_id: int, device_id: str, data: dict):
        """Manda a UN dispositivo concreto de un jugador — para la
        señalización de una llamada 1-a-1 ya en marcha, que debe ir solo al
        dispositivo que de verdad está en esa llamada, no a todos los que
        ese jugador tenga abiertos a la vez."""
        async with self._lock:
            ws = self._conns.get(player_id, {}).get(device_id)
        if not ws:
            return
        try:
            await ws.send_text(json.dumps(data, default=str))
        except Exception:
            await self._drop(player_id, device_id, ws)

    def devices_of(self, player_id: int) -> list[str]:
        return list(self._conns.get(player_id, {}).keys())

    async def _drop(self, player_id: int, device_id: str, ws: WebSocket):
        async with self._lock:
            devices = self._conns.get(player_id)
            if devices and devices.get(device_id) is ws:
                devices.pop(device_id, None)
                if not devices:
                    self._conns.pop(player_id, None)

    async def kick(self, player_id: int):
        """Cierra TODAS las conexiones de un jugador (todos sus dispositivos)
        — para cuando el admin lo desactiva o lo borra y tiene que perder el
        acceso al instante en cualquier sitio donde tuviera sesión abierta.
        El cierre dispara solo la limpieza normal (finally del
        websocket_endpoint) en cada una, no hace falta nada más aquí."""
        async with self._lock:
            snapshot = list(self._conns.get(player_id, {}).values())
        for ws in snapshot:
            try:
                await ws.close(code=4001)
            except Exception:
                pass


manager = ConnectionManager()
