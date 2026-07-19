import type * as Party from 'partykit/server'

interface PlayerState {
  id: string
  x: number
  y: number
  anim: string
  seatIdx?: number
}

export default class VillageParty implements Party.Server {
  players: Map<string, PlayerState> = new Map()

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Enviar estado actual a la nueva conexión
    for (const [id, state] of this.players) {
      conn.send(JSON.stringify({ type: 'move', ...state }))
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg = JSON.parse(message)
      const id  = sender.id

      if (msg.type === 'move') {
        const state: PlayerState = { id, x: msg.x, y: msg.y, anim: msg.anim }
        this.players.set(id, state)
        this.room.broadcast(JSON.stringify({ type: 'move', ...state }), [id])
      }

      if (msg.type === 'sit') {
        const state = this.players.get(id)
        if (state) {
          state.seatIdx = msg.seatIdx
          this.players.set(id, state)
        }
        this.room.broadcast(JSON.stringify({ type: 'sit', id, seatIdx: msg.seatIdx }), [id])
      }

      if (msg.type === 'stand') {
        const state = this.players.get(id)
        if (state) { delete state.seatIdx; this.players.set(id, state) }
        this.room.broadcast(JSON.stringify({ type: 'stand', id }), [id])
      }
    } catch {}
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id)
    this.room.broadcast(JSON.stringify({ type: 'leave', id: conn.id }))
  }
}
