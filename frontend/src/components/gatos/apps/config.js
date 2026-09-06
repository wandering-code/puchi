export const APPS = {
  diskordkito: {
    id:     'diskordkito',
    title:  'Diskordkito',
    icon:   '🐱',
    color:  '#5865f2',
    width:  740,
    height: 520,
    requires: 'club_member', // oculto a quien no sea miembro del club
  },
  luniteca: {
    id:     'luniteca',
    title:  'Luniteca',
    icon:   '📚',
    color:  '#d97706',
    width:  820,
    height: 560,
    hidden: true,
  },
  luniteca2: {
    id:     'luniteca2',
    title:  'Luniteca',
    icon:   '📚',
    color:  '#c97d4e',
    width:  820,
    height: 560,
  },
  luniteca3: {
    id:     'luniteca3',
    title:  'Luniteca (nueva)',
    icon:   '📖',
    color:  '#b5603c',
    width:  820,
    height: 560,
    adminOnly: true, // rediseño en curso (issue #8) — solo wander, mientras se prueba
  },
  settings: {
    id:     'settings',
    title:  'Ajustes',
    icon:   '⚙️',
    color:  '#4b5563',
    width:  480,
    height: 440,
    // Visible para cualquier jugador aprobado, sea o no del club — issue
    // reportada: antes llevaba requires:'club_member', pero Ajustes es solo
    // cuenta personal (nombre, avatar, PIN, borrado) y preferencias de
    // comportamiento del dispositivo (modo ventana, barra inferior), nunca
    // nada específico del club — eso (fondos de pantalla) va aparte en
    // Pirestore, que sí sigue restringido. No tiene sentido que alguien sin
    // club no pueda ni cambiar su propio PIN.
  },
  pirestore: {
    id:     'pirestore',
    title:  'Pirestore',
    icon:   '🛍️',
    color:  '#ec4899',
    width:  780,
    height: 560,
    requires: 'club_member',
  },
  admin: {
    id:     'admin',
    title:  'Admin',
    icon:   '🛡️',
    color:  '#64748b',
    width:  640,
    height: 540,
    adminOnly: true, // solo visible para wander
  },
}

// Único sitio que decide si una app se ve — usado por Dock, MobileLauncher,
// MenuBar y GatOS, para no duplicar (y desincronizar) el mismo criterio en
// varios sitios. Quien no es miembro del club solo debe ver Luniteca: nada
// de Diskordkito, Pirestore ni Ajustes — ni siquiera como icono deshabilitado,
// para que no sepa que existen.
export function isAppVisible(app, player, isAdmin) {
  if (!app) return false
  // El admin ve todo siempre; cualquier otro jugador puede tener acceso a
  // una app "adminOnly" concreta si se le ha concedido a mano desde el
  // panel Admin (player.extra_apps, ver AdminPanel.jsx) — pensado para
  // dejar probar algo en desarrollo (p.ej. Luniteca (nueva)) a alguien que
  // no es del club, sin abrírselo a todo el mundo. El panel de Admin en sí
  // nunca se concede así, solo por ser admin de verdad.
  if (app.adminOnly) return !!isAdmin || (app.id !== 'admin' && !!player?.extra_apps?.includes(app.id))
  if (app.requires === 'club_member') return !!player?.club_member
  return true
}

// Apps "adminOnly" que sí se pueden conceder a mano a un jugador concreto
// (todas salvo el propio panel de Admin) — usado por AdminPanel.jsx para
// no tener que mantener esa lista por separado ahí.
export function grantableApps() {
  return Object.values(APPS).filter(a => a.adminOnly && a.id !== 'admin' && !a.hidden)
}
