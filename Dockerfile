FROM node:18

RUN apt-get update && \
apt-get install -y ffmpeg icecast2 && \
echo "✅ Installed ffmpeg and icecast2"

WORKDIR /app
COPY . .

EXPOSE 10000

CMD bash -c "icecast -c /app/icecast.xml & node server.js"