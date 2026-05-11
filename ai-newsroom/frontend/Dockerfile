ARG NODE_BASE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim

FROM ${NODE_BASE_IMAGE} AS deps

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

COPY package.json package-lock.json ./
RUN npm ci


FROM ${NODE_BASE_IMAGE} AS builder

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG INTERNAL_API_URL=http://backend:8000
ARG INTERNAL_ASSET_URL=http://backend:8000
ARG MINIO_BUCKET=newsroom-images
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
ENV INTERNAL_ASSET_URL=${INTERNAL_ASSET_URL}
ENV MINIO_BUCKET=${MINIO_BUCKET}

RUN npm run build


FROM ${NODE_BASE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV INTERNAL_API_URL=http://backend:8000
ENV INTERNAL_ASSET_URL=http://backend:8000
ENV MINIO_BUCKET=newsroom-images

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
