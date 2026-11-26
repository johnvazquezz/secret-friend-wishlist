# Entorno de pruebas local: la app compilada como en producción, servida por nginx.
# La usa docker-compose.yml (npm run local:up). No se usa para desplegar: producción va por Vercel.

# --- Build -------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Sin scripts de instalación: evita descargar el binario de la CLI de Supabase (no hace falta
# para compilar). esbuild y rollup traen su binario nativo como dependencia opcional.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# Variables públicas que Vite incrusta en el bundle (las mismas que en Vercel).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_VAPID_PUBLIC_KEY=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

RUN npm run build

# --- Servidor ----------------------------------------------------------------
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
