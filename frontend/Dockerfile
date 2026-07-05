# ============================================================
# Stage 1 — builder
# ============================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /build

# Install dependencies first (layer-cache friendly)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy all source files and compile
COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY src/ ./src/
RUN npm run build

# ============================================================
# Stage 2 — runner (nginx)
# ============================================================
FROM nginx:1.25-alpine@sha256:516475cc129da42866742567714ddc681e5eed7b9ee0b9e9c015e464b4221a00 AS runner

# Remove default nginx config and content. Install curl so the HEALTHCHECK
# doesn't depend on wget being present in the base image.
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/* \
  && apk add --no-cache curl

# Copy compiled Angular app
COPY --from=builder /build/dist/interop-frontend/browser /usr/share/nginx/html

# Copy nginx configuration — uses envsubst for BACKEND_URL at startup
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-security-headers.conf /etc/nginx/nginx-security-headers.conf

# Create temp dirs nginx needs when running as non-root
RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
  && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html \
  && chmod -R 755 /var/cache/nginx

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
