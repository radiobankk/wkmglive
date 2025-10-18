# Base image
FROM node:18

# Install Icecast and FFmpeg
RUN apt-get update && \
apt-get install -y icecast2 ffmpeg && \
mkdir -p /etc/icecast && \
cp /usr/share/icecast2/icecast.xml /etc/icecast/icecast.xml

# Replace default Icecast config with your custom one
COPY icecast.xml /etc/icecast/icecast.xml

# Create app directory
WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install
COPY . .

# Expose Icecast + Express API
EXPOSE 8080

# Start Icecast and Node backend
CMD icecast -c /etc/icecast/icecast.xml & node server.js
