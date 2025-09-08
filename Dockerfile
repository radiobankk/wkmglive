FROM node:18

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Copy your app
WORKDIR /app
COPY . .

# Install dependencies
RUN npm install

CMD ["node", "server.js"]
