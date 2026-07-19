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
  settings: {
    id:     'settings',
    title:  'Ajustes',
    icon:   '⚙️',
    color:  '#4b5563',
    width:  480,
    height: 440,
    requires: 'club_member', // sin acceso al club, solo hay Luniteca — nada de perfil/estética
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
  if (app.adminOnly) return !!isAdmin
  if (app.requires === 'club_member') return !!player?.club_member
  return true
}
