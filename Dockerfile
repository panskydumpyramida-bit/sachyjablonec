FROM node:22-slim

RUN apt-get update && apt-get install -y openssl python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json prisma/ ./prisma-tmp/
RUN mv prisma-tmp/package*.json . && mv prisma-tmp prisma
RUN npm install --omit=dev && npx prisma generate

COPY . .

EXPOSE 3001

CMD ["./start.sh"]
