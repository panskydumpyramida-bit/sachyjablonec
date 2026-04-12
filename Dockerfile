FROM node:22-slim

RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .
RUN npm install --omit=dev --ignore-scripts && npx prisma generate

EXPOSE 3001

CMD ["./start.sh"]
