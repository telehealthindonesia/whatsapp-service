# Stage 1: Build TypeScript
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Stage 2: Production Runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/public ./src/public
COPY src/public ./dist/public

# Direktori sesi dan upload
RUN mkdir -p /app/sessions /app/uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]
