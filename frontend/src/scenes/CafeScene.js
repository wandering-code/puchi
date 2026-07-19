import Phaser from 'phaser'
import { createPlayerAnimations } from '../utils/animations'
import { PartyClient } from '../utils/partyClient'
import { createActionPrompt, createWorldHint } from '../utils/ui'

const PLAYER_SPEED = 90
const W = 20 * 32, H = 16 * 32
const DOOR_W = 48

const PLAYERS = [
  { id: 1, name: 'Lara',   colorHex: '#e879f9' },
  { id: 2, name: 'Nadia',  colorHex: '#34d399' },
  { id: 3, name: 'Wander', colorHex: '#60a5fa' },
]

// Tres sillas alrededor de la mesa central
const SEATS = [
  { x: W / 2 - 36, y: H / 2 + 4 },
  { x: W / 2,      y: H / 2 + 4 },
  { x: W / 2 + 36, y: H / 2 + 4 },
]

export class CafeScene extends Phaser.Scene {
  constructor() { super('CafeScene') }

  init(data) {
    this.villageSpawnX = data?.spawnX ?? null
    this.villageSpawnY = data?.spawnY ?? null
  }

  create() {
    const player   = this.registry.get('player')
    this.playerKey = `char-${player.name.toLowerCase()}`

    this.physics.world.setBounds(0, 0, W, H)

    // ── Mapa ────────────────────────────────────────────────────────────────
    const bg = this.add.graphics()
    bg.fillStyle(0x78350f).fillRect(0, 0, W, H)
    bg.fillStyle(0x7c3aed).fillRect(W / 2 - 100, H / 2 - 80, 200, 160)
    // Mesa
    bg.fillStyle(0x92400e).fillRect(W / 2 - 52, H / 2 - 18, 104, 36)
    bg.fillStyle(0x6b2e08).fillRect(W / 2 - 52, H / 2 - 18, 104, 4)
    // Sillas vacías
    bg.fillStyle(0x3b1a08)
    SEATS.forEach(s => {
      bg.fillRect(s.x - 12, s.y - 10, 24, 20)
      bg.fillStyle(0x2a1206)
      bg.fillRect(s.x - 12, s.y - 10, 24, 4)   // respaldo
      bg.fillStyle(0x3b1a08)
    })
    // Paredes con hueco
    bg.fillStyle(0x451a03)
    bg.fillRect(0, 0, W, 32)
    bg.fillRect(0, 0, 32, H)
    bg.fillRect(W - 32, 0, 32, H)
    bg.fillRect(0, H - 32, W / 2 - DOOR_W / 2, 32)
    bg.fillRect(W / 2 + DOOR_W / 2, H - 32, W / 2 - DOOR_W / 2, 32)
    bg.fillStyle(0x1c0a00).fillRect(W / 2 - DOOR_W / 2, H - 32, DOOR_W, 32)
    // Decoración
    bg.fillStyle(0xfbbf24)
    bg.fillRect(60, 10, 40, 24)
    bg.fillRect(W - 100, 10, 40, 24)

    // ── Colisiones ───────────────────────────────────────────────────────────
    this.walls = this.physics.add.staticGroup()
    const addWall = (x, y, w, h) => {
      const r = this.add.rectangle(x + w/2, y + h/2, w, h).setVisible(false)
      this.physics.add.existing(r, true)
      this.walls.add(r)
    }
    addWall(0,                    0,      W,                   32)
    addWall(0,                    0,      32,                  H)
    addWall(W - 32,               0,      32,                  H)
    addWall(0,                    H - 32, W / 2 - DOOR_W / 2, 32)
    addWall(W / 2 + DOOR_W / 2,   H - 32, W / 2 - DOOR_W / 2, 32)

    // ── Zona de salida ───────────────────────────────────────────────────────
    this.exitZone = this.add.zone(W / 2, H - 16, DOOR_W, 32)
    this.physics.world.enable(this.exitZone)
    this.exitZone.body.setAllowGravity(false)
    this.exitZone.body.moves = false

    // ── Personaje local ──────────────────────────────────────────────────────
    this.localPlayer = this.physics.add.sprite(W / 2, H - 80, this.playerKey, 0)
    this.localPlayer.setCollideWorldBounds(true)
    this.physics.add.collider(this.localPlayer, this.walls)
    for (const p of PLAYERS) createPlayerAnimations(this, p.name.toLowerCase())

    this.nameText = this.add.text(0, 0, player.name, {
      fontFamily: '"Press Start 2P"', fontSize: '6px',
      color: player.color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(5)

    this.cameras.main.startFollow(this.localPlayer)
    this.cameras.main.setBounds(0, 0, W, H)
    this.cameras.main.setZoom(2)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' })
    this.eKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.vKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V)

    // ── Zonas de silla con hints ─────────────────────────────────────────────
    this.seatZones = SEATS.map((s, i) => {
      const z = this.add.zone(s.x, s.y, 32, 28)
      this.physics.world.enable(z)
      z.body.setAllowGravity(false)
      z.body.moves = false
      z.seatIdx = i
      z.hint = createWorldHint(this, s.x, s.y - 14, '[E]')
      // Etiqueta de ocupante (oculta hasta que alguien se siente)
      z.occupantLabel = this.add.text(s.x, s.y - 24, '', {
        fontFamily: '"Press Start 2P"', fontSize: '5px',
        color: '#ffd700', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(6).setVisible(false)
      return z
    })

    // ── UI ───────────────────────────────────────────────────────────────────
    this.actionPrompt = createActionPrompt(this)

    // Indicador de jugadores en sala + prompt de videollamada
    this.presenceText = this.add.text(this.scale.width / 2, 12, '', {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: '#ffd700', stroke: '#000', strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5, 0).setDepth(100)

    // ── Estado ───────────────────────────────────────────────────────────────
    this.seated         = false         // ¿está el jugador local sentado?
    this.localSeatIdx   = null
    this.remoteSprites  = {}
    this.sittingPlayers = {}            // id → seatIdx (jugadores remotos)
    this.jitsiStarted   = false

    this.party = new PartyClient('cafe', player, {
      onPlayerMove:  (id, x, y, anim) => this._updateRemote(id, x, y, anim),
      onPlayerLeave: (id)             => this._removeRemote(id),
      onSit:         (id, idx)        => { this.sittingPlayers[id] = idx; this._updateSeatLabel(idx, id) },
      onStand:       (id)             => { this._clearSeatLabel(this.sittingPlayers[id]); delete this.sittingPlayers[id] },
    })
  }

  update() {
    // ── Movimiento (solo si no está sentado) ─────────────────────────────────
    if (!this.seated) {
      const { left, right, up, down } = this.cursors
      const wasd = this.wasd
      let vx = 0, vy = 0, moving = false

      if (left.isDown  || wasd.left.isDown)  { vx = -PLAYER_SPEED; moving = true }
      if (right.isDown || wasd.right.isDown) { vx =  PLAYER_SPEED; moving = true }
      if (up.isDown    || wasd.up.isDown)    { vy = -PLAYER_SPEED; moving = true }
      if (down.isDown  || wasd.down.isDown)  { vy =  PLAYER_SPEED; moving = true }

      this.localPlayer.setVelocity(vx, vy)

      const dir  = vy < 0 ? 'up' : vy > 0 ? 'down' : vx < 0 ? 'left' : vx > 0 ? 'right' : null
      const name = this.playerKey.replace('char-', '')
      const anim = dir && moving ? `${name}-walk-${dir}` : `${name}-idle`
      this.localPlayer.anims.play(anim, true)
      this.nameText.setPosition(this.localPlayer.x, this.localPlayer.y - 18)
      this.party.sendMove(this.localPlayer.x, this.localPlayer.y, anim)

      // Salir por la puerta
      if (Phaser.Geom.Rectangle.Overlaps(this.localPlayer.getBounds(), this.exitZone.getBounds())) {
        this.party.disconnect()
        this.scene.start('VillageScene', { spawnX: this.villageSpawnX, spawnY: this.villageSpawnY })
        return
      }

      // Detectar silla cercana
      let nearSeat = null
      for (const z of this.seatZones) {
        if (Phaser.Geom.Rectangle.Overlaps(this.localPlayer.getBounds(), z.getBounds())) {
          const ocupada = this._isSeatOccupied(z.seatIdx)
          if (!ocupada) { nearSeat = z; break }
        }
      }

      // Hints y prompt
      for (const z of this.seatZones) {
        const libre = !this._isSeatOccupied(z.seatIdx)
        z.hint.setVisible(libre && z === nearSeat)
      }

      if (nearSeat) {
        this.actionPrompt.show('Sentarse  [E]')
      } else {
        this.actionPrompt.hide()
      }

      if (Phaser.Input.Keyboard.JustDown(this.eKey) && nearSeat) {
        this._sit(nearSeat.seatIdx)
      }

    } else {
      // ── Sentado: solo permite levantarse ─────────────────────────────────
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this._stand()
      }
    }

    // ── Trigger videollamada (cuando los 3 están en la sala) ─────────────────
    const enSala = Object.keys(this.remoteSprites).length + 1
    if (enSala >= 3) {
      this.presenceText.setText('¡Todos en la cafetería!  [V] Videollamada')
      if (Phaser.Input.Keyboard.JustDown(this.vKey) && !this.jitsiStarted) {
        this.jitsiStarted = true
        window.dispatchEvent(new CustomEvent('luni:openJitsi'))
      }
    } else {
      this.presenceText.setText(enSala === 1 ? 'Solo tú en la sala' : `${enSala}/3 en la cafetería`)
    }
  }

  _sit(seatIdx) {
    const seat = SEATS[seatIdx]
    this.seated       = true
    this.localSeatIdx = seatIdx
    this.localPlayer.setVelocity(0, 0)
    this.localPlayer.setPosition(seat.x, seat.y)

    const name = this.playerKey.replace('char-', '')
    this.localPlayer.anims.play(`${name}-idle`, true)
    this.nameText.setVisible(false)   // ocultar el flotante que sigue al personaje

    const player = this.registry.get('player')
    this._setSeatLabel(seatIdx, player.name, player.color)

    this.actionPrompt.show('Levantarse  [E]')
    this.party.sendSit(seatIdx)
  }

  _stand() {
    this.seated = false
    this._clearSeatLabel(this.localSeatIdx)
    this.localSeatIdx = null
    this.nameText.setVisible(true)
    this.actionPrompt.hide()
    this.party.sendStand()
  }

  _isSeatOccupied(idx) {
    if (this.seated && this.localSeatIdx === idx) return true
    return Object.values(this.sittingPlayers).includes(idx)
  }

  _setSeatLabel(idx, name, color = '#ffffff') {
    const label = this.seatZones[idx]?.occupantLabel
    if (label) label.setText(name).setColor(color).setVisible(true)
  }

  _clearSeatLabel(idx) {
    if (idx == null) return
    const label = this.seatZones[idx]?.occupantLabel
    if (label) label.setVisible(false)
  }

  _updateSeatLabel(idx, playerId) {
    const p = PLAYERS.find(p => `${p.name.toLowerCase()}_${p.id}` === playerId)
               ?? { name: playerId.split('_')[0], colorHex: '#ffffff' }
    this._setSeatLabel(idx, p.name, p.colorHex)
  }

  _updateRemote(id, x, y, anim) {
    if (!this.remoteSprites[id]) {
      const charKey = `char-${id.split('_')[0]}`
      const sprite  = this.add.sprite(x, y, charKey, 0).setDepth(4)
      const label   = this.add.text(x, y - 18, id.split('_')[0], {
        fontFamily: '"Press Start 2P"', fontSize: '6px',
        color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(5)
      this.remoteSprites[id] = { sprite, label }
    }
    const { sprite, label } = this.remoteSprites[id]
    // Si está sentado, no actualizar posición desde el movimiento
    if (!Object.prototype.hasOwnProperty.call(this.sittingPlayers, id)) {
      sprite.setPosition(x, y)
      label.setPosition(x, y - 18)
    }
    if (this.anims.exists(anim)) sprite.anims.play(anim, true)
  }

  _removeRemote(id) {
    const r = this.remoteSprites[id]
    if (r) { r.sprite.destroy(); r.label.destroy() }
    delete this.remoteSprites[id]
    this._clearSeatLabel(this.sittingPlayers[id])
    delete this.sittingPlayers[id]
  }
}
