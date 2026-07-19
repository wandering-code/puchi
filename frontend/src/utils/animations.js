// Crea animaciones walk/idle para un personaje dado su nombre.
// Asume spritesheet con 12 frames: filas down(0-2), left(3-5), right(6-8), up(9-11)
export function createPlayerAnimations(scene, name) {
  const key = `char-${name}`
  if (scene.anims.exists(`${name}-walk-down`)) return

  const dirs = [
    { dir: 'down',  start: 0,  end: 2  },
    { dir: 'left',  start: 3,  end: 5  },
    { dir: 'right', start: 6,  end: 8  },
    { dir: 'up',    start: 9,  end: 11 },
  ]

  for (const { dir, start, end } of dirs) {
    scene.anims.create({
      key: `${name}-walk-${dir}`,
      frames: scene.anims.generateFrameNumbers(key, { start, end }),
      frameRate: 8,
      repeat: -1,
    })
  }

  scene.anims.create({
    key: `${name}-idle`,
    frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 0 }),
    frameRate: 1,
    repeat: -1,
  })
}
