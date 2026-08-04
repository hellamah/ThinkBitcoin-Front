#!/bin/sh

# A URL da API é resolvida em tempo de build (VITE_API_URL, exigida pelo guard em
# vite.config.mjs), não mais em runtime: o env-config.js que este script
# preenchia era lido por ninguém. Para apontar a imagem para outra API, rebuilde
# passando --build-arg VITE_API_URL=...

exec "$@"
