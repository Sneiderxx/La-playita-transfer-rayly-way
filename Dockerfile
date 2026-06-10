FROM node:22-slim
WORKDIR /app
COPY artifacts/api-server/dist ./dist
COPY artifacts/api-server/package.json ./package.json
RUN npm install --production
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]