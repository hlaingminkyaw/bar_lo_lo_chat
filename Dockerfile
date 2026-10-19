FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code and assets
COPY api/ ./api/
COPY lib/ ./lib/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY data/ ./data/
COPY vercel.json ./
COPY RULES.md ./

EXPOSE 3000

CMD ["node", "scripts/dev-server.js"]
