# Stage 1: Build React frontend
FROM node:18 AS frontend-builder

WORKDIR /react
COPY resume1-main/ ./resume1-main/
WORKDIR /react/resume1-main

# Avoid minification errors by disabling optimization
ENV CI=false
RUN npm install && npm run build

# Stage 2: Final image with Icecast, FFmpeg, and Node backend
FROM node:18

# Install Icecast and FFmpeg
RUN apt-get update && \
apt-get install -y icecast2 ffmpeg && \
mkdir -p /etc/icecast

# Copy Icecast config
COPY wkmglive/icecast.xml /etc/icecast/icecast.xml

# Create app directory
WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install
COPY . .

# Copy built React frontend
COPY --from=frontend-builder /react/resume1-main/build ./public

# Expose Icecast + Express API
EXPOSE 8080

# Start Icecast and backend
CMD icecast -c /etc/icecast/icecast.xml & node server.js
