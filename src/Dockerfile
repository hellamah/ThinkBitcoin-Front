# node:22 porque o vite 7 declara engines `^20.19.0 || >=22.12.0`. Em node:18 o
# `npm install` so avisava (EBADENGINE) e seguia: a imagem buildava sobre um
# runtime que a toolchain nao suporta, e o desenvolvimento local ja usa 22.
FROM node:22 AS build
WORKDIR /app
ARG VITE_API_URL=https://localhost:13501
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .

# A suite roda ANTES do build, e falhar aqui aborta a imagem. Ate agora nada
# executava os testes no caminho de release: o pipeline builda a imagem e a
# imagem so fazia `npm install` + `npm run build`. Existiam centenas de testes
# que nenhuma etapa cobrava — rede de seguranca que so protegia quem lembrasse
# de rodar na mao.
#
# O lint entra junto, e antes dos testes: ele e mais rapido e pega a classe de
# erro mais barata de corrigir. Ficou de fora ate agora porque o repositorio
# carregava 58 erros de quando a config existia sem poder rodar; hoje sao zero.
# Restam 30 avisos, que nao travam o gate de proposito — sao dividas conhecidas
# (`exhaustive-deps` e `only-export-components`), nao defeitos.
RUN npm run lint

RUN npm test

RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

