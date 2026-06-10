FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm install -g pnpm@10.11.0
RUN sed -i 's/minimumReleaseAge: 1440/minimumReleaseAge: 0/' pnpm-workspace.yaml
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
WORKDIR /app/artifacts/api-server
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]