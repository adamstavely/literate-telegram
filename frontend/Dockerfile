# ============================================================
# Stage 1 — Angular builder
# ============================================================
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS angular-builder

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY frontend/angular.json frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.spec.json ./
COPY frontend/src ./src/
RUN npm run build

# ============================================================
# Stage 2 — Astro docs builder (Astro 7 requires Node >= 22.12)
# ============================================================
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS docs-builder

WORKDIR /build

COPY docs/package.json docs/package-lock.json ./docs/
RUN cd docs && npm ci

COPY docs ./docs
COPY project/docs-content.js ./project/docs-content.js
COPY project/styles.css ./project/styles.css
WORKDIR /build/docs
RUN npm run content:sync && npm run build

# ============================================================
# Stage 3 — runner (nginx)
# ============================================================
FROM nginx:1.25-alpine@sha256:516475cc129da42866742567714ddc681e5eed7b9ee0b9e9c015e464b4221a00 AS runner

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/* \
  && apk add --no-cache curl

COPY --from=angular-builder /build/frontend/dist/interop-frontend/browser /usr/share/nginx/html
COPY --from=docs-builder /build/docs/dist/docs /usr/share/nginx/html/docs
COPY --from=docs-builder /build/docs/dist/_astro /usr/share/nginx/html/_astro
COPY --from=docs-builder /build/docs/public/fonts /usr/share/nginx/html/fonts

COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY frontend/nginx-security-headers.conf /etc/nginx/nginx-security-headers.conf

RUN mkdir -p /var/cache/nginx/client_temp \
             /var/cache/nginx/proxy_temp \
             /var/cache/nginx/fastcgi_temp \
             /var/cache/nginx/uwsgi_temp \
             /var/cache/nginx/scgi_temp \
  && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html \
  && chmod -R 755 /var/cache/nginx

COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
