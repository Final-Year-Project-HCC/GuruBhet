# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
# Note: libc6-compat is often needed for Next.js on Alpine
RUN apk add --no-cache libc6-compat

# Copy lockfiles first
COPY package.json package-lock.json ./

# FIX: 'npm ci' is significantly faster in Docker/CI than 'npm install'
RUN npm ci --legacy-peer-deps

COPY . .

# FIX: You must declare ARGs here so Next.js can see them during 'npm run build'
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# FIX: Don't run as root for security. Alpine node image has a 'node' user.
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone mode only copies what is strictly needed
COPY --from=builder /app/public ./public
# Set the correct permission for the standalone folder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]