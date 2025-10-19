FROM node:18

RUN apt-get update && \
apt-get install -y icecast2 ffmpeg && \
echo "✅ Icecast installed" && \
which icecast

WORKDIR /app
COPY . .

EXPOSE 10000

CMD bash -c "icecast -c /app/icecast.xml & node server.js"