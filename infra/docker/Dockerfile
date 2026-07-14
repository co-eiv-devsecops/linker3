FROM node:22-slim AS deps

WORKDIR /opt/linker

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-slim

WORKDIR /opt/linker
ENV NODE_ENV=production

COPY package.json ./
COPY --from=deps /opt/linker/node_modules ./node_modules
COPY src ./src
COPY public ./public

RUN groupadd --system linker \
  && useradd --system --gid linker --home-dir /opt/linker --shell /usr/sbin/nologin linker \
  && chown -R linker:linker /opt/linker
USER linker

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/main.ts"]
