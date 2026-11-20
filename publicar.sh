#!/bin/sh
# Marca una versión nueva antes de publicar: los teléfonos con la app instalada verán "Hay una nueva edición".
V=$(date +%Y%m%d%H%M)
sed -i -E "s#^const VERSION = \".*\";#const VERSION = \"$V\";#" sw.js
sed -i -E "s#<script src=\"(pwa|santoral|siembra|almanaque)\.js(\?v=[0-9]+)?\"></script>#<script src=\"\1.js?v=$V\"></script>#g" index.html
echo "Versión $V"
