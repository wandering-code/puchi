import Phaser from 'phaser'
import { PreloadScene }  from './scenes/PreloadScene'
import { VillageScene }  from './scenes/VillageScene'
import { CafeScene }     from './scenes/CafeScene'
import { LibraryScene }  from './scenes/LibraryScene'

export function createGame(parent, player) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width:  window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade:  { gravity: { y: 0 }, debug: false },
    },
    scene: [PreloadScene, VillageScene, CafeScene, LibraryScene],
    callbacks: {
      preBoot(g) {
        g.registry.set('player', player)
      },
    },
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      // Desactiva la captura de teclas cuando el foco está en un input/textarea de React
      keyboard: { capture: [] },
    },
  })

  // Pausa el teclado de Phaser cuando el usuario escribe en cualquier campo de texto
  const pauseKeys  = () => { game.input.keyboard.enabled = false }
  const resumeKeys = () => { game.input.keyboard.enabled = true  }
  document.addEventListener('focusin',  (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) pauseKeys()
  })
  document.addEventListener('focusout', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) resumeKeys()
  })

  return game
}
