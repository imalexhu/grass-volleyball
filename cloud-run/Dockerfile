FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npx tsc

EXPOSE 8080

ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]
