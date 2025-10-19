# Use Node base image
FROM node:18-slim

# Install system ffmpeg and Icecast
RUN apt-get update && \
apt-get install -y ffmpeg icecast2 && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files including start.sh
COPY . .

# Make start.sh executable
RUN chmod +x ./start.sh

# Expose your metadata API port
EXPOSE 10000

# Start Icecast and Node backend
CMD ["./start.sh"]
