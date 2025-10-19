# Base image with Node.js
FROM node:18-slim

# Install system ffmpeg and Icecast
RUN apt-get update && \
apt-get install -y ffmpeg icecast2 && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy project files
COPY server.js /app/server.js
COPY icecast.xml /app/icecast.xml
COPY schedule.json /app/schedule.json
COPY artwork.json /app/artwork.json
COPY web /app/web

# Install dependencies
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm install

# Expose Icecast and Node ports
EXPOSE 10000

# Start Icecast and Node server
CMD icecast -c /app/icecast.xml & node server.js
