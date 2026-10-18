#!/bin/bash
# Copia de seguridad de Puchi, cada noche a las 4:00 (crontab de wander en el
# mini PC: `0 4 * * * /home/wander/apps/puchi/backup.sh`).
#
# - La base de datos (pg_dump) y uploads/ (portadas, lomos, avatares): copia
#   completa cada noche, 14 días de historia, en disco y en el USB.
# - backend/datos/ (audiolibros: audio, EPUB; y las claves del sobremesa y de
#   los push): espejo incremental en el USB. Solo copia lo que cambia, que el
#   audio ocupa mucho y cuesta horas de sobremesa regenerarlo. Lo que se borra
#   o se sustituye (un capítulo regenerado) se aparta 30 días en
#   datos_retirados/, por si se borró sin querer.
#
# Al acabar deja backend/datos/copia_estado.json, que Puchi enseña al admin
# en Audiolibros (y avisa si es de hace más de un día).
#
# Restaurar (en el mini PC, con el backend parado si se pisa todo):
# - Audiolibros y claves:
#     rsync -a /mnt/backups/puchi/datos/ /home/wander/apps/puchi/backend/datos/
#   Un archivo borrado sin querer en los últimos 30 días está en
#   /mnt/backups/puchi/datos_retirados/<fecha>/ con su misma ruta.
# - Base de datos:
#     docker exec -i puchi-db-1 pg_restore -U luni -d luni --clean < /mnt/backups/puchi/puchi_prod_<fecha>.dump
# - Imágenes: tar -xzf /mnt/backups/puchi/puchi_uploads_<fecha>.tar.gz -C backend/
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR=/home/wander/apps/puchi
LOCAL_DIR="$APP_DIR/backend/backups"
USB_DIR=/mnt/backups/puchi
LOG="$APP_DIR/backup.log"
RETENTION_DAYS=14
RETIRADOS_DAYS=30
ESTADO="$APP_DIR/backend/datos/copia_estado.json"

mkdir -p "$LOCAL_DIR"

docker exec puchi-db-1 pg_dump -U luni -Fc luni > "$LOCAL_DIR/puchi_prod_${DATE}.dump"
tar -czf "$LOCAL_DIR/puchi_uploads_${DATE}.tar.gz" -C "$APP_DIR/backend" uploads

usb_ok=false
if mountpoint -q /mnt/backups; then
  usb_ok=true
  mkdir -p "$USB_DIR"
  cp "$LOCAL_DIR/puchi_prod_${DATE}.dump" "$USB_DIR/"
  cp "$LOCAL_DIR/puchi_uploads_${DATE}.tar.gz" "$USB_DIR/"
  find "$USB_DIR" -maxdepth 1 -name "puchi_prod_*.dump" -mtime +$RETENTION_DAYS -delete
  find "$USB_DIR" -maxdepth 1 -name "puchi_uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

  # Audiolibros y claves: espejo incremental. El estado de la propia copia no
  # hace falta copiarlo.
  rsync -a --delete --exclude copia_estado.json \
    --backup --backup-dir="$USB_DIR/datos_retirados/$DATE" \
    "$APP_DIR/backend/datos/" "$USB_DIR/datos/"
  find "$USB_DIR/datos_retirados" -mindepth 1 -maxdepth 1 -type d -mtime +$RETIRADOS_DAYS -exec rm -rf {} + 2>/dev/null || true
else
  echo "$(date "+%F %T"): AVISO - /mnt/backups no esta montado (pen desconectado?), backup solo en disco local" >> "$LOG"
fi

find "$LOCAL_DIR" -name "puchi_prod_*.dump" -mtime +$RETENTION_DAYS -delete
find "$LOCAL_DIR" -name "puchi_uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# El resumen para Puchi. Si algo de arriba falla, set -e corta antes de
# llegar aquí y el estado se queda viejo: eso es justo lo que avisa.
audio_bytes=$(du -sb "$APP_DIR/backend/datos/audiolibros/audio" 2>/dev/null | cut -f1 || echo 0)
audio_files=$(find "$APP_DIR/backend/datos/audiolibros/audio" -name "*.m4a" 2>/dev/null | wc -l)
if $usb_ok; then
  read -r usb_total usb_libre < <(df -B1 --output=size,avail /mnt/backups | tail -1)
  copia_bytes=$(du -sb "$USB_DIR/datos" | cut -f1)
else
  usb_total=0; usb_libre=0; copia_bytes=0
fi
cat > "$ESTADO.tmp" <<EOF
{"at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "usb": $usb_ok, "audio_files": $audio_files, "audio_bytes": ${audio_bytes:-0}, "copy_bytes": $copia_bytes, "usb_total": $usb_total, "usb_free": $usb_libre, "db_dump": "puchi_prod_${DATE}.dump"}
EOF
mv "$ESTADO.tmp" "$ESTADO"

echo "$(date "+%F %T"): backup completado (${DATE})" >> "$LOG"
