FROM node:24-alpine AS base

RUN apk add --no-cache libc6-compat \
  && addgroup --gid 1001 -S nodejs \
  && adduser --uid 1001 -S nextjs -G nodejs

WORKDIR /app
COPY package*.json ./

FROM base AS development
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev:container"]

FROM base AS deps
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1/
ARG NEXT_PUBLIC_BASE_PATH=
ARG SITE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV SITE_URL=${SITE_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
RUN addgroup --gid 1001 -S nodejs \
  && adduser --uid 1001 -S nextjs -G nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3001
CMD ["node", "server.js"]
