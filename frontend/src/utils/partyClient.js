import PartySocket from 'partysocket'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999'

export class PartyClient {
  constructor(room, player, handlers) {
    this.player   = player
    this.handlers = handlers
    this.lastSent = 0

    this.socket = new PartySocket({
      host:  PARTYKIT_HOST,
      room,
      id:    `${player.name.toLowerCase()}_${player.id}`,
    })

    this.socket.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        this._handle(msg)
      } catch {}
    })
  }

  _handle(msg) {
    const h = this.handlers
    if (msg.type === 'move'  && h.onPlayerMove)  h.onPlayerMove(msg.id, msg.x, msg.y, msg.anim)
    if (msg.type === 'leave' && h.onPlayerLeave) h.onPlayerLeave(msg.id)
    if (msg.type === 'sit'   && h.onSit)         h.onSit(msg.id, msg.seatIdx)
    if (msg.type === 'stand' && h.onStand)        h.onStand(msg.id)
  }

  sendMove(x, y, anim) {
    const now = Date.now()
    if (now - this.lastSent < 50) return  // throttle a 20 fps
    this.lastSent = now
    this._send({ type: 'move', x: Math.round(x), y: Math.round(y), anim })
  }

  sendSit(seatIdx) {
    this._send({ type: 'sit', seatIdx })
  }

  sendStand() {
    this._send({ type: 'stand' })
  }

  _send(data) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data))
    }
  }

  disconnect() {
    this.socket.close()
  }
}
