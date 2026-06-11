FROM node:22-slim
WORKDIR /app
COPY artifacts/api-server/dist ./dist
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]