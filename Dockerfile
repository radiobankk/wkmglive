# Use Node base image
FROM node:18-slim

# Install system ffmpeg and Icecast
RUN apt-get update && \
apt-get install -y ffmpeg icecast2 && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN npm install

# Expose your metadata API port
EXPOSE 10000

# Start your backend and FFmpeg stream
CMD ["node", "server.js"]
