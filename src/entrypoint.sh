#!/bin/sh

# Substitui o placeholder ${VITE_API_URL} no arquivo js pelo valor real da variável de ambiente do SO
if [ -n "$VITE_API_URL" ]; then
  echo "Injetando VITE_API_URL=$VITE_API_URL em /usr/share/nginx/html/env-config.js"
  sed -i "s|\${VITE_API_URL}|$VITE_API_URL|g" /usr/share/nginx/html/env-config.js
fi

exec "$@"
