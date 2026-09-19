# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- run ----
FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/app/data
WORKDIR /app
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY package.json ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "server/index.js"]
