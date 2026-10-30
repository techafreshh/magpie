# Multi-stage build: the full toolchain compiles the SPA, the runtime image
# ships only dist/ + the zero-dependency server (no node_modules at runtime).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.mjs ./
ENV PORT=8080
# 0.0.0.0 inside the container — Caddy reaches it over the shared network.
EXPOSE 8080
CMD ["node", "server.mjs"]
