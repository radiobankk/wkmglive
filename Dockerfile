# Base image with Node.js
FROM node:18

# Install Icecast and FFmpeg
RUN apt-get update && \
apt-get install -y icecast2 ffmpeg && \
mkdir -p /etc/icecast

# Copy your custom Icecast config from the wkmglive folder
COPY stream-wkmg/wkmglive/icecast.xml /etc/icecast/icecast.xml

# Create app directory
WORKDIR /app

# Copy backend files
COPY package*.json ./
RUN npm install
COPY . .

# Expose Icecast + Express API
EXPOSE 10000

# Start Icecast and Node backend
CMD icecast -c /etc/icecast/icecast.xml & node server.js
