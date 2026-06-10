FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --ignore-scripts
RUN pnpm --filter @workspace/api-server run build
WORKDIR /app/artifacts/api-server
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]