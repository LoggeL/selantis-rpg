FROM node:22-alpine AS build
WORKDIR /app
COPY game/package.json game/package-lock.json ./game/
RUN npm ci --prefix game
COPY . .
RUN npm test --prefix game && npm run build --prefix game && node scripts/assemble_site.mjs

FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/output/site/ /usr/share/nginx/html/
RUN nginx -t
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
