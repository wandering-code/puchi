#!/usr/bin/env bash
# Cambia qué versión de Puchi se sirve en la raíz (puchi.wanderingcode.dev).
#
#   ./cambiar-version.sh anterior   -> la de antes de pasar los audiolibros a
#                                      producción (tag produccion-antes-audiolibros)
#   ./cambiar-version.sh nueva      -> la de ahora, la del repo (frontend-next/dist)
#
# Solo cambia la web: el backend y la base de datos son los mismos para las
# dos (lo nuevo solo AÑADE rutas, tablas y columnas, y la versión anterior no
# las usa). /kokito no se toca nunca: sigue siendo la de prueba.
#
# La anterior vive compilada en /home/wander/apps/puchi-anterior (un git
# worktree en el tag), así que el cambio es instantáneo: no compila nada.
# Copia de la base de datos de antes del cambio:
#   /mnt/backups/puchi/puchi_antes_produccion_20261018.dump
# (para restaurarla, ver la cabecera de backup.sh).
set -euo pipefail

CONF=/etc/nginx/sites-enabled/puchi
NUEVA=/home/wander/apps/puchi/frontend-next/dist
ANTERIOR=/home/wander/apps/puchi-anterior/frontend-next/dist

case "${1:-}" in
  anterior) DESTINO=$ANTERIOR ;;
  nueva)    DESTINO=$NUEVA ;;
  *) echo "Uso: $0 anterior|nueva"; grep -m1 '^    root ' "$CONF"; exit 1 ;;
esac

[ -f "$DESTINO/index.html" ] || { echo "No existe $DESTINO/index.html"; exit 1; }

sudo cp "$CONF" "/home/wander/apps/puchi/nginx-puchi.antes-de-cambiar.conf"
# Solo la primera línea "root" (la de la raíz): /v1 y /kokito van con alias.
sudo sed -i --follow-symlinks "0,/^    root .*;/s##    root $DESTINO;#" "$CONF"
sudo nginx -t
sudo systemctl reload nginx
echo "Raíz de Puchi ahora:"
grep -m1 '^    root ' "$CONF"
