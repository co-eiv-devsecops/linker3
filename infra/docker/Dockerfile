FROM node:22-slim

WORKDIR /opt/linker

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]
