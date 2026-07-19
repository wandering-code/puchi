import Phaser from 'phaser'
import { createPlayerAnimations } from '../utils/animations'
import { PartyClient } from '../utils/partyClient'
import { createActionPrompt, createWorldHint } from '../utils/ui'

const PLAYER_SPEED = 120
const MAP_W = 40, MAP_H = 30, TILE = 32

// Frames del tileset Kenney Tiny Town (16×16, escalado ×2 = 32px visual)
// Índices 0-based: fila × 12 + columna
const T = {
  GRASS:        0,   // hierba lisa
  GRASS_SPARK:  1,   // hierba con brillo
  GRASS_TUFT:   2,   // hierba con matorral
  TREE_AUTUMN:  3,   // árbol otoño naranja
  TREE_DARK:    4,   // conífera oscura
  TREE_SMALL:   5,   // árbol pequeño
  COBBLE:       96,  // adoquín gris (camino)
  COBBLE_V2:    97,  // adoquín variante
}

// Paleta de colores del tileset para que los edificios hagan juego
const PAL = {
  BRICK:      0xd4763b,   // ladrillo naranja
  SLATE:      0x6b7d8b,   // tejado pizarra gris
  WOOD:       0x8b5e3c,   // madera
  WINDOW:     0x8bbfe8,   // ventana azul
  DOOR_DARK:  0x5c3317,   // puerta oscura
  WALL_GRAY:  0x9aabb8,   // pared gris piedra
  WALL_LIGHT: 0xc8d4da,   // pared gris clara
}

const BUILDINGS = [
  { label: 'Casa Lara',    key: null,           col: 4,  row: 2, w: 4, h: 4, style: 'house_purple' },
  { label: 'Casa Nadia',   key: null,           col: 10, row: 2, w: 4, h: 4, style: 'house_green'  },
  { label: 'Casa Wander',  key: null,           col: 16, row: 2, w: 4, h: 4, style: 'house_blue'   },
  { label: 'Cafetería',    key: 'CafeScene',    col: 23, row: 2, w: 6, h: 5, style: 'cafe'         },
  { label: 'Biblioteca',   key: 'LibraryScene', col: 31, row: 2, w: 7, h: 5, style: 'library'      },
]

// Árboles decorativos [col, row, frame]
const TREES = [
  // Borde superior
  [0,0,T.TREE_DARK],[1,0,T.TREE_DARK],[2,0,T.TREE_AUTUMN],[3,0,T.TREE_DARK],
  [8,0,T.TREE_DARK],[9,0,T.TREE_AUTUMN],[21,0,T.TREE_DARK],[22,0,T.TREE_SMALL],
  [28,0,T.TREE_DARK],[29,0,T.TREE_DARK],[36,0,T.TREE_AUTUMN],[37,0,T.TREE_DARK],
  [38,0,T.TREE_DARK],[39,0,T.TREE_DARK],
  // Laterales izquierda
  [0,2,T.TREE_DARK],[0,3,T.TREE_AUTUMN],[0,5,T.TREE_DARK],[0,6,T.TREE_DARK],
  [0,8,T.TREE_AUTUMN],[0,10,T.TREE_DARK],[0,12,T.TREE_DARK],
  // Laterales derecha
  [39,2,T.TREE_DARK],[39,3,T.TREE_DARK],[39,5,T.TREE_AUTUMN],[39,7,T.TREE_DARK],
  [39,9,T.TREE_DARK],[39,11,T.TREE_AUTUMN],[39,13,T.TREE_DARK],
  // Entre edificios / zona media
  [8,3,T.TREE_SMALL],[9,2,T.TREE_DARK],[21,3,T.TREE_AUTUMN],[22,2,T.TREE_DARK],
  [29,3,T.TREE_SMALL],
  // Zona inferior
  [1,20,T.TREE_DARK],[2,21,T.TREE_AUTUMN],[3,22,T.TREE_DARK],
  [10,22,T.TREE_DARK],[11,21,T.TREE_AUTUMN],[15,20,T.TREE_SMALL],
  [20,21,T.TREE_DARK],[25,22,T.TREE_AUTUMN],[30,21,T.TREE_DARK],
  [35,20,T.TREE_DARK],[37,22,T.TREE_AUTUMN],[38,21,T.TREE_DARK],
  [1,26,T.TREE_AUTUMN],[5,28,T.TREE_DARK],[12,27,T.TREE_DARK],
  [20,29,T.TREE_SMALL],[28,28,T.TREE_AUTUMN],[36,27,T.TREE_DARK],
]

export class VillageScene extends Phaser.Scene {
  constructor() { super('VillageScene') }

  init(data) {
    this.spawnX = data?.spawnX ?? null
    this.spawnY = data?.spawnY ?? null
  }

  create() {
    const player   = this.registry.get('player')
    this.playerKey = `char-${player.name.toLowerCase()}`

    const worldW = MAP_W * TILE, worldH = MAP_H * TILE
    this.physics.world.setBounds(0, 0, worldW, worldH)

    // ── Suelo con tileset real (Kenney Tiny Town) ────────────────────────────
    const groundData = _makeGround()
    const map     = this.make.tilemap({ data: groundData, tileWidth: 16, tileHeight: 16 })
    const tileset = map.addTilesetImage('tiny-town')
    const ground  = map.createLayer(0, tileset, 0, 0)
    ground.setScale(2)   // 16px → 32px visual, mismo tamaño de mundo

    // ── Árboles decorativos usando frames del mismo spritesheet ───────────────
    for (const [col, row, frame] of TREES) {
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, 'tiny-town', frame)
        .setScale(2)
        .setDepth(row + 0.5)
    }

    // ── Edificios (estilo tileset) ────────────────────────────────────────────
    this.buildingZones = []
    this.walls = this.physics.add.staticGroup()

    for (const b of BUILDINGS) {
      const bx = b.col * TILE, by = b.row * TILE
      const bw = b.w * TILE,   bh = b.h * TILE
      this._drawBuilding(bx, by, bw, bh, b.style)

      // Etiqueta
      this.add.text(bx + bw / 2, by - 8, b.label, {
        fontFamily: '"Press Start 2P"', fontSize: '5px',
        color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(50)

      // Colisión
      const body = this.add.rectangle(bx + bw/2, by + (bh-12)/2, bw, bh-12).setVisible(false)
      this.physics.add.existing(body, true)
      this.walls.add(body)

      // Zona de entrada
      if (b.key) {
        const doorX = bx + bw / 2
        const doorY = by + bh + 4
        const zone  = this.add.zone(doorX, doorY, bw, 20)
        this.physics.world.enable(zone)
        zone.body.setAllowGravity(false)
        zone.body.moves = false
        zone.sceneKey = b.key
        zone.label    = b.label
        zone.spawnX   = doorX
        zone.spawnY   = doorY + 28
        zone.hint     = createWorldHint(this, doorX, by + bh - 4, '[E]')
        this.buildingZones.push(zone)
      }
    }

    // Bordes del mundo (invisibles)
    const ET = 16
    ;[[0,0,worldW,ET],[0,worldH-ET,worldW,ET],[0,0,ET,worldH],[worldW-ET,0,ET,worldH]]
      .forEach(([x,y,w,h]) => {
        const r = this.add.rectangle(x+w/2, y+h/2, w, h).setVisible(false)
        this.physics.add.existing(r, true)
        this.walls.add(r)
      })

    // ── Personaje local ──────────────────────────────────────────────────────
    const startX = this.spawnX ?? worldW / 2
    const startY = this.spawnY ?? worldH / 2
    this.localPlayer = this.physics.add.sprite(startX, startY, this.playerKey, 0).setDepth(20)
    this.localPlayer.setCollideWorldBounds(true)
    this.physics.add.collider(this.localPlayer, this.walls)
    for (const n of ['lara', 'nadia', 'wander']) createPlayerAnimations(this, n)

    this.nameText = this.add.text(0, 0, player.name, {
      fontFamily: '"Press Start 2P"', fontSize: '6px',
      color: player.color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(21)

    // ── Cámara ───────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.localPlayer)
    this.cameras.main.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setZoom(2)

    // ── Input ────────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' })
    this.eKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)

    this.actionPrompt = createActionPrompt(this)

    // ── Multijugador ─────────────────────────────────────────────────────────
    this.remoteSprites = {}
    this.party = new PartyClient('village', player, {
      onPlayerMove:  (id, x, y, anim) => this._updateRemote(id, x, y, anim),
      onPlayerLeave: (id)             => this._removeRemote(id),
    })
    this.activeZone = null
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

    // Depth dinámico para que los árboles tapen al personaje cuando pasa por detrás
    this.localPlayer.setDepth(Math.floor(this.localPlayer.y / TILE) + 0.9)
    this.nameText.setPosition(this.localPlayer.x, this.localPlayer.y - 18)
    this.nameText.setDepth(this.localPlayer.depth + 0.1)

    // Detección de zonas
    const prevZone = this.activeZone
    this.activeZone = null
    for (const zone of this.buildingZones) {
      if (Phaser.Geom.Rectangle.Overlaps(this.localPlayer.getBounds(), zone.getBounds())) {
        this.activeZone = zone; break
      }
    }
    for (const zone of this.buildingZones) zone.hint?.setVisible(zone === this.activeZone)
    if (this.activeZone) this.actionPrompt.show(`Entrar en ${this.activeZone.label}  [E]`)
    else                 this.actionPrompt.hide()

    if (Phaser.Input.Keyboard.JustDown(this.eKey) && this.activeZone) {
      this.party.disconnect()
      this.scene.start(this.activeZone.sceneKey, {
        from: 'VillageScene', spawnX: this.activeZone.spawnX, spawnY: this.activeZone.spawnY,
      })
    }

    this.party.sendMove(this.localPlayer.x, this.localPlayer.y, anim)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _drawBuilding(bx, by, bw, bh, style) {
    const g = this.add.graphics().setDepth(by / TILE)

    // Base común: pared de piedra gris
    g.fillStyle(PAL.WALL_LIGHT)
    g.fillRect(bx, by, bw, bh)

    // Tejado (franja superior) con color según estilo
    const roofH = Math.floor(bh * 0.35)
    const roofColor = {
      house_purple: 0xa855f7, house_green: 0x10b981, house_blue: 0x3b82f6,
      cafe: PAL.BRICK, library: PAL.SLATE,
    }[style] ?? PAL.SLATE
    g.fillStyle(roofColor)
    g.fillRect(bx, by, bw, roofH)

    // Sombra bajo el tejado
    g.fillStyle(0x00000022)
    g.fillRect(bx, by + roofH, bw, 3)

    // Pared inferior (piedra gris clara)
    g.fillStyle(PAL.WALL_GRAY)
    g.fillRect(bx + 3, by + roofH + 3, bw - 6, bh - roofH - 15)

    // Ventanas
    g.fillStyle(PAL.WINDOW)
    const winY = by + roofH + 8
    g.fillRect(bx + 6, winY, 8, 8)
    g.fillRect(bx + bw - 14, winY, 8, 8)
    // Marco de ventana
    g.lineStyle(1, 0x4a6fa5)
    g.strokeRect(bx + 6, winY, 8, 8)
    g.strokeRect(bx + bw - 14, winY, 8, 8)

    // Puerta centrada
    g.fillStyle(PAL.DOOR_DARK)
    g.fillRect(bx + bw/2 - 6, by + bh - 14, 12, 14)
    // Marco de puerta
    g.lineStyle(1, PAL.WOOD)
    g.strokeRect(bx + bw/2 - 6, by + bh - 14, 12, 14)

    // Borde exterior del edificio
    g.lineStyle(2, 0x00000040)
    g.strokeRect(bx, by, bw, bh)
  }

  _updateRemote(id, x, y, anim) {
    if (!this.remoteSprites[id]) {
      const charKey = `char-${id.split('_')[0]}`
      const sprite  = this.add.sprite(x, y, charKey, 0)
      const label   = this.add.text(x, y - 18, id.split('_')[0], {
        fontFamily: '"Press Start 2P"', fontSize: '6px',
        color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 1)
      this.remoteSprites[id] = { sprite, label }
    }
    const { sprite, label } = this.remoteSprites[id]
    sprite.setPosition(x, y).setDepth(Math.floor(y / TILE) + 0.9)
    label.setPosition(x, y - 18).setDepth(sprite.depth + 0.1)
    if (this.anims.exists(anim)) sprite.anims.play(anim, true)
  }

  _removeRemote(id) {
    const r = this.remoteSprites[id]
    if (r) { r.sprite.destroy(); r.label.destroy() }
    delete this.remoteSprites[id]
  }
}

// Genera los datos del suelo: hierba con variación + caminos de adoquín
function _makeGround() {
  const data = []
  // Camino horizontal centrado: filas 13-15
  // Camino vertical centrado: cols 18-20
  for (let row = 0; row < MAP_H; row++) {
    const rowData = []
    for (let col = 0; col < MAP_W; col++) {
      const isH = row >= 13 && row <= 15
      const isV = col >= 18 && col <= 20
      if (isH || isV) {
        rowData.push(T.COBBLE + (Math.random() < 0.3 ? 1 : 0))
      } else {
        const r = Math.random()
        rowData.push(r < 0.04 ? T.GRASS_SPARK : r < 0.08 ? T.GRASS_TUFT : T.GRASS)
      }
    }
    data.push(rowData)
  }
  return data
}
