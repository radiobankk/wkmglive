# Use an official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your app
COPY . .

# Optional: Add FFmpeg if needed for media processing
RUN apk add --no-cache ffmpeg

# Expose port (adjust if your app uses a different one)
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
