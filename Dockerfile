FROM node:18

RUN apt-get update && \
DEBIAN_FRONTEND=noninteractive apt-get install -y icecast2 ffmpeg && \
echo "✅ Installed icecast2 and ffmpeg"

WORKDIR /app
COPY . .

EXPOSE 10000

CMD bash -c "icecast -c /app/icecast.xml & node server.js"