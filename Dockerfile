# Use Node base image
FROM node:18-slim

# Install FFmpeg, Icecast, and Ices2
RUN apt-get update && \
apt-get install -y ffmpeg icecast2 ices2 && \
id -u icecast >/dev/null 2>&1 || adduser --disabled-password --gecos "" --ingroup icecast icecast && \
apt-get clean && \
rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files including start.sh and ices config
COPY . .

# Ensure required directories exist
RUN mkdir -p /app/log /app/web /app/admin

# Make start.sh executable
RUN chmod +x ./start.sh

# Expose Icecast and metadata API port
EXPOSE 10000

# Start Icecast, FFmpeg, Ices2, and Node backend
CMD ["./start.sh"]