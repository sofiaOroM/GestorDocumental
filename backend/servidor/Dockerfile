FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
EXPOSE 3000

# Carga inicial solo si la base está vacía; luego arranca la API
CMD ["sh", "-c", "node scripts/seed-if-empty.js && node src/server.js"]
