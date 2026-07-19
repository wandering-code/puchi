// Crea el HUD de acción fijo al fondo de pantalla
export function createActionPrompt(scene) {
  // Contenedor fijo a la cámara
  const container = scene.add.container(scene.scale.width / 2, scene.scale.height - 52)
  container.setScrollFactor(0).setDepth(200).setVisible(false)

  // Fondo semitransparente
  const bg = scene.add.graphics()
  container.add(bg)

  // Texto
  const txt = scene.add.text(0, 0, '', {
    fontFamily: '"Press Start 2P"',
    fontSize: '8px',
    color: '#ffffff',
  }).setOrigin(0.5)
  container.add(txt)

  // Expone métodos directamente en el container
  container.show = (text) => {
    txt.setText(text)
    // Redibuja el fondo ajustado al texto
    const pad = { x: 16, y: 10 }
    const w   = txt.width  + pad.x * 2
    const h   = txt.height + pad.y * 2
    bg.clear()
    bg.fillStyle(0x000000, 0.78)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6)
    bg.lineStyle(1, 0xffd700, 0.6)
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6)
    container.setVisible(true)
  }

  container.hide = () => container.setVisible(false)

  return container
}

// Indicador flotante "[E]" encima de un objeto en coordenadas mundo
export function createWorldHint(scene, x, y, label = '[E]') {
  return scene.add.text(x, y, label, {
    fontFamily: '"Press Start 2P"',
    fontSize: '6px',
    color: '#ffd700',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5, 1).setDepth(50).setVisible(false)
}
