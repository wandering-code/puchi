import Phaser from 'phaser'
import { createPlayerAnimations } from '../utils/animations'
import { PartyClient } from '../utils/partyClient'
import { createActionPrompt, createWorldHint } from '../utils/ui'

const PLAYER_SPEED = 90
const W = 24 * 32   // 768
const H = 20 * 32   // 640
const DOOR_W = 48

const PLAYERS = [
  { id: 1, name: 'Lara',   color: 0xe879f9, colorHex: '#e879f9' },
  { id: 2, name: 'Nadia',  color: 0x34d399, colorHex: '#34d399' },
  { id: 3, name: 'Wander', color: 0x60a5fa, colorHex: '#60a5fa' },
]

// Estanterías personales: fila superior
const SHELF_W = 176, SHELF_H = 112
const GAP     = (W - 64 - 3 * SHELF_W) / 2
const PERSONAL_SHELVES = PLAYERS.map((p, i) => ({
  ...p,
  x: 32 + i * (SHELF_W + GAP),
  y: 48,
}))

// Estantería del club: isla central, con pasillos a ambos lados para poder pasar
const CLUB_W = W - 240   // deja 120px de pasillo a cada lado
const CLUB_SHELF = { x: (W - CLUB_W) / 2, y: H / 2 - 36, w: CLUB_W, h: 72 }

export class LibraryScene extends Phaser.Scene {
  constructor() { super('LibraryScene') }

  init(data) {
    this.villageSpawnX = data?.spawnX ?? null
    this.villageSpawnY = data?.spawnY ?? null
  }

  create() {
    const currentPlayer = this.registry.get('player')
    this.playerKey      = `char-${currentPlayer.name.toLowerCase()}`

    this.physics.world.setBounds(0, 0, W, H)
    this.walls      = this.physics.add.staticGroup()
    this.shelfZones = []

    // ── Suelo ────────────────────────────────────────────────────────────────
    const bg = this.add.graphics()
    bg.fillStyle(0x78350f).fillRect(0, 0, W, H)
    bg.fillStyle(0x6b2d0a)
    for (let y = 0; y < H; y += 32) bg.fillRect(0, y, W, 2)

    // Alfombra central
    bg.fillStyle(0x1e3a5f).fillRect(32, PERSONAL_SHELVES[0].y + SHELF_H + 16, W - 64, H - PERSONAL_SHELVES[0].y - SHELF_H - 80)

    // ── Estanterías personales ────────────────────────────────────────────────
    for (const s of PERSONAL_SHELVES) {
      this._drawShelf(bg, s.x, s.y, SHELF_W, SHELF_H, s.color)

      this.add.text(s.x + SHELF_W / 2, s.y - 10, s.name, {
        fontFamily: '"Press Start 2P"', fontSize: '7px',
        color: s.colorHex, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 1)

      this._addWall(s.x, s.y, SHELF_W, SHELF_H)

      const zone = this._addZone(s.x + SHELF_W / 2, s.y + SHELF_H + 14, SHELF_W, 22)
      zone.shelfType  = 'personal'
      zone.playerId   = s.id
      zone.playerName = s.name
      zone.hint = createWorldHint(this, s.x + SHELF_W / 2, s.y + SHELF_H + 4)
      this.shelfZones.push(zone)
    }

    // ── Estantería del club ───────────────────────────────────────────────────
    const cs = CLUB_SHELF
    this._drawShelf(bg, cs.x, cs.y, cs.w, cs.h, 0xfbbf24)
    this.add.text(cs.x + cs.w / 2, cs.y - 10, 'Club de Lectura', {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: '#fbbf24', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 1)
    this._addWall(cs.x, cs.y, cs.w, cs.h)
    // Zona de interacción por ambos lados
    for (const [offsetY, hintY] of [[-14, cs.y - 4], [cs.h + 14, cs.y + cs.h + 4]]) {
      const clubZone = this._addZone(cs.x + cs.w / 2, cs.y + offsetY, cs.w, 22)
      clubZone.shelfType = 'club'
      clubZone.hint = createWorldHint(this, cs.x + cs.w / 2, hintY)
      this.shelfZones.push(clubZone)
    }

    // ── Paredes exteriores con hueco de puerta ────────────────────────────────
    bg.fillStyle(0x1c1410)
    bg.fillRect(0,                    0,      W,                   32)
    bg.fillRect(0,                    0,      32,                  H)
    bg.fillRect(W - 32,               0,      32,                  H)
    bg.fillRect(0,                    H - 32, W/2 - DOOR_W/2,     32)
    bg.fillRect(W/2 + DOOR_W/2,       H - 32, W/2 - DOOR_W/2,    32)
    bg.fillStyle(0x0a0603).fillRect(W/2 - DOOR_W/2, H - 32, DOOR_W, 32)

    this._addWall(0,                  0,      W,                   32)
    this._addWall(0,                  0,      32,                  H)
    this._addWall(W - 32,             0,      32,                  H)
    this._addWall(0,                  H - 32, W/2 - DOOR_W/2,     32)
    this._addWall(W/2 + DOOR_W/2,     H - 32, W/2 - DOOR_W/2,    32)

    // ── Zona de salida ───────────────────────────────────────────────────────
    this.exitZone = this._addZone(W / 2, H - 16, DOOR_W, 32)

    // ── Personaje local ──────────────────────────────────────────────────────
    // Spawn en el pasillo inferior (entre estantería del club y la puerta)
    this.localPlayer = this.physics.add.sprite(W / 2, CLUB_SHELF.y + CLUB_SHELF.h + 60, this.playerKey, 0)
    this.localPlayer.setCollideWorldBounds(true)
    this.physics.add.collider(this.localPlayer, this.walls)

    // Animaciones para todos los jugadores (necesario para sprites remotos)
    for (const p of PLAYERS) createPlayerAnimations(this, p.name.toLowerCase())

    this.nameText = this.add.text(0, 0, currentPlayer.name, {
      fontFamily: '"Press Start 2P"', fontSize: '6px',
      color: currentPlayer.color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(5)

    this.cameras.main.startFollow(this.localPlayer)
    this.cameras.main.setBounds(0, 0, W, H)
    this.cameras.main.setZoom(2)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' })
    this.eKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)

    this.actionPrompt = createActionPrompt(this)

    this.activeShelfZone = null
    this.remoteSprites   = {}

    this.party = new PartyClient('library', currentPlayer, {
      onPlayerMove:  (id, x, y, anim) => this._updateRemote(id, x, y, anim),
      onPlayerLeave: (id)             => this._removeRemote(id),
    })
  }

  update() {
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

    if (Phaser.Geom.Rectangle.Overlaps(this.localPlayer.getBounds(), this.exitZone.getBounds())) {
      this.party.disconnect()
      this.scene.start('VillageScene', { spawnX: this.villageSpawnX, spawnY: this.villageSpawnY })
      return
    }

    this.activeShelfZone = null
    for (const zone of this.shelfZones) {
      if (Phaser.Geom.Rectangle.Overlaps(this.localPlayer.getBounds(), zone.getBounds())) {
        this.activeShelfZone = zone
        break
      }
    }

    // Hints flotantes + prompt
    for (const zone of this.shelfZones) {
      zone.hint?.setVisible(zone === this.activeShelfZone)
    }
    if (this.activeShelfZone) {
      const z = this.activeShelfZone
      this.actionPrompt.show(
        z.shelfType === 'club' ? 'Ver estantería del club  [E]' : `Ver estantería de ${z.playerName}  [E]`
      )
    } else {
      this.actionPrompt.hide()
    }

    if (Phaser.Input.Keyboard.JustDown(this.eKey) && this.activeShelfZone) {
      const z = this.activeShelfZone
      window.dispatchEvent(new CustomEvent('luni:openLibrary', {
        detail: { tab: z.shelfType === 'club' ? 'club' : 'personal', playerId: z.playerId ?? null },
      }))
    }
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
    sprite.setPosition(x, y)
    label.setPosition(x, y - 18)
    if (this.anims.exists(anim)) sprite.anims.play(anim, true)
  }

  _removeRemote(id) {
    const r = this.remoteSprites[id]
    if (r) { r.sprite.destroy(); r.label.destroy() }
    delete this.remoteSprites[id]
  }

  _drawShelf(g, x, y, w, h, color) {
    g.fillStyle(0x2d1810).fillRect(x, y, w, h)
    g.fillStyle(0x451a03)
    g.fillRect(x,         y,         w,  6)
    g.fillRect(x,         y + h - 6, w,  6)
    g.fillRect(x,         y,         6,  h)
    g.fillRect(x + w - 6, y,         6,  h)

    const shelfCount = Math.max(1, Math.floor(h / 38))
    for (let i = 1; i < shelfCount; i++) {
      g.fillStyle(0x451a03)
      g.fillRect(x + 6, y + i * 38, w - 12, 4)
    }

    const bookColors = [color, 0xf59e0b, 0xffffff & (color >> 1) | 0x220000, 0x6366f1, 0xef4444, color ^ 0x223344]
    for (let row = 0; row < shelfCount; row++) {
      const rowY = y + row * 38 + 8
      let bx = x + 10
      for (let b = 0; b < 8 && bx < x + w - 14; b++) {
        const bw = 10 + (b % 3) * 4
        const bh = 22 + (b % 2) * 4
        g.fillStyle(bookColors[b % bookColors.length])
        g.fillRect(bx, rowY, bw, bh)
        g.fillStyle(0x00000055)
        g.fillRect(bx, rowY, 1, bh)
        bx += bw + 2
      }
    }
  }

  _addWall(x, y, w, h) {
    const r = this.add.rectangle(x + w/2, y + h/2, w, h).setVisible(false)
    this.physics.add.existing(r, true)
    this.walls.add(r)
  }

  _addZone(cx, cy, w, h) {
    const z = this.add.zone(cx, cy, w, h)
    this.physics.world.enable(z)
    z.body.setAllowGravity(false)
    z.body.moves = false
    return z
  }
}
