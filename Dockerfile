FROM node:22-slim AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY lib/db ./lib/db
COPY lib/api-zod ./lib/api-zod
COPY artifacts/api-server ./artifacts/api-server

RUN npm install -g pnpm@11.5.0 --ignore-scripts
RUN pnpm install --filter @workspace/api-server... --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/artifacts/api-server/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]