# Fase 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copiem fitxers de configuració
COPY package*.json ./
COPY prisma ./prisma/

# Instal·lem dependències
RUN npm install

# Copiem el codi font i compilem
COPY . .
RUN npx prisma generate
RUN npm run build

# Fase 2: Run
FROM node:20-slim

WORKDIR /app

# Copiem només el necessari del builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Exposem el port 3000
EXPOSE 3000

# Comanda per defecte
CMD ["npm", "start"]
