import Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene') }

  preload() {
    // Tileset exterior — Kenney Tiny Town (CC0)
    this.load.spritesheet('tiny-town', '/assets/tilesets/tiny-town.png', {
      frameWidth: 16, frameHeight: 16,
    })
  }

  create() {
    _generateCharTextures(this)
    this.scene.start('VillageScene')
  }
}

// Genera un spritesheet de placeholder con canvas nativo.
// Layout: 3 columnas (frames de animación) × 4 filas (down, left, right, up)
// Cada frame: 32×32 px
function _generateCharTextures(scene) {
  const CHARS = [
    { name: 'lara',   body: '#e879f9', hair: '#fbbf24' },
    { name: 'nadia',  body: '#34d399', hair: '#92400e' },
    { name: 'wander', body: '#60a5fa', hair: '#1e1e1e' },
  ]
  const FW = 32, FH = 32, COLS = 3, ROWS = 4

  for (const c of CHARS) {
    const key = `char-${c.name}`
    if (scene.textures.exists(key)) continue

    const canvas = document.createElement('canvas')
    canvas.width  = FW * COLS
    canvas.height = FH * ROWS
    const ctx = canvas.getContext('2d')

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x   = col * FW
        const y   = row * FH
        const bob = col === 1 ? 0 : 1   // frames 0 y 2 ligeramente más abajo

        // Cuerpo
        ctx.fillStyle = c.body
        ctx.fillRect(x + 10, y + 14 + bob, 12, 12)

        // Cabeza
        ctx.fillStyle = '#fde68a'
        ctx.fillRect(x + 9, y + 4 + bob, 14, 12)

        // Pelo
        ctx.fillStyle = c.hair
        ctx.fillRect(x + 9, y + 3 + bob, 14, 5)

        // Ojos (solo en fila "down", row 0)
        if (row === 0) {
          ctx.fillStyle = '#1e1e1e'
          ctx.fillRect(x + 12, y + 9 + bob, 2, 2)
          ctx.fillRect(x + 18, y + 9 + bob, 2, 2)
        }

        // Piernas con efecto de caminar
        ctx.fillStyle = '#374151'
        const legBob = col === 0 ? -2 : col === 2 ? 2 : 0
        ctx.fillRect(x + 11, y + 24 + bob,          4, 6)
        ctx.fillRect(x + 17, y + 24 + bob + legBob, 4, 6)
      }
    }

    // Registrar textura y definir frames manualmente
    scene.textures.addCanvas(key, canvas)
    const tex = scene.textures.get(key)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        tex.add(row * COLS + col, 0, col * FW, row * FH, FW, FH)
      }
    }
  }
}
