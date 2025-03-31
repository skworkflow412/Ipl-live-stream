# Build stage
FROM node:16 as builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:16-alpine

WORKDIR /app
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

WORKDIR /app/server
RUN npm install --production

EXPOSE 3000
CMD ["node", "index.js"]
