FROM node:22-slim
WORKDIR /app
COPY artifacts/api-server/package.json ./package.json
RUN npm install --omit=dev
COPY artifacts/api-server/dist ./dist
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]