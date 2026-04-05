#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (plugin)
sudo apt install -y docker-compose-plugin

# Create app directory
mkdir -p /opt/tusecre
cd /opt/tusecre

# Clone TuSecre (using main branch)
git clone https://github.com/damensa/LaSecre.git .

# Create .env file with current values or placeholders
# (The user will need to edit this file later with real secrets)
touch .env

echo "✅ Docker installed and code cloned!"
echo "⚠️  Ara has d'editar el fitxer .env amb les teves claus secretes: nano .env"
echo "🚀 Després, executa: sudo docker compose up -d --build"
