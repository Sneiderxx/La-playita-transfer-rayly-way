FROM node:22-slim
WORKDIR /app
COPY artifacts/api-server/dist ./dist
COPY artifacts/api-server/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]