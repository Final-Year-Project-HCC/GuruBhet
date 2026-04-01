FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN for i in 1 2 3; do npm ci && break || sleep 5; done
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone mode only copies what is strictly needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]