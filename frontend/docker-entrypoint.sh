#!/bin/sh
set -e

# Substitute BACKEND_URL in the nginx config template.
# Default to "backend:3000" when the env var is not set.
BACKEND_URL="${BACKEND_URL:-backend:3000}"

export BACKEND_URL

# Use envsubst to render the upstream placeholder in nginx.conf.
# Only substitute $BACKEND_URL so other nginx variables (like $host) are preserved.
envsubst '$BACKEND_URL' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.tmp
mv /etc/nginx/nginx.conf.tmp /etc/nginx/nginx.conf

exec "$@"
