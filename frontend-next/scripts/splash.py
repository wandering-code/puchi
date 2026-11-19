# Genera las imágenes de arranque de iOS (public/splash/) a partir del logo.
#   python3 scripts/splash.py        (necesita Pillow)
#
# iOS no fabrica el splash con el manifest: si no hay una imagen que encaje
# EXACTAMENTE con la pantalla, abre la app instalada en blanco. Cada imagen es
# el fondo crema con el logo centrado al mismo tamaño que el splash de
# index.html y de App.jsx, así que se pasa de la imagen de iOS al splash HTML
# y de ahí a React sin ningún cambio visible.
import json, os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(AQUI, '..', 'public')
cfg = json.load(open(os.path.join(AQUI, 'splash-devices.json')))
logo = Image.open(os.path.join(PUBLIC, 'icons', 'logo.png')).convert('RGBA')
os.makedirs(os.path.join(PUBLIC, 'splash'), exist_ok=True)
for w, h, r, _ in cfg['dispositivos']:
    lienzo = Image.new('RGB', (w * r, h * r), cfg['fondo'])
    lado = cfg['logo'] * r
    pieza = logo.resize((lado, lado), Image.LANCZOS)
    lienzo.paste(pieza, ((w * r - lado) // 2, (h * r - lado) // 2), pieza)
    lienzo.quantize(colors=64).save(os.path.join(PUBLIC, 'splash', f'launch-{w * r}x{h * r}.png'), optimize=True)
# El logo del splash de index.html, a 3x de sus 48px: el de los iconos
# (logo.png, 256px) pesa 56 KB, y en la primera visita le quitaba red al CSS.
logo.resize((cfg['logo'] * 3, cfg['logo'] * 3), Image.LANCZOS).save(
    os.path.join(PUBLIC, 'icons', 'splash-logo.webp'), quality=90, method=6)
print('Imágenes de arranque en public/splash/ y public/icons/splash-logo.webp')
