#!/bin/bash

echo "🚀 Starting WKMGLIVE Broadcast Backend..."

# Trap to clean up background processes on exit
trap 'kill $(jobs -p)' EXIT

# Start Icecast with privilege drop and log output
echo "📡 Launching Icecast..."
su -s /bin/sh icecast -c "icecast2 -c ./icecast.xml" > ./log/icecast.log 2>&1 &
sleep 2

# Confirm Icecast is listening internally
echo "🔍 Checking Icecast health..."
if command -v curl > /dev/null; then
curl --silent --max-time 5 http://localhost:10000/status.xsl > /dev/null
if [ $? -ne 0 ]; then
echo "❌ Icecast failed to start or is unreachable on port 10000"
tail -n 20 ./log/icecast.log
exit 1
fi
echo "✅ Icecast is live."
else
echo "⚠️ Skipping health check — curl not installed"
fi

# Check upstream stream availability
echo "🔎 Checking upstream stream availability..."
if ! curl --silent --head --fail http://208.89.99.124:5004/auto/v6.1 > /dev/null; then
echo "❌ Upstream stream is unreachable. Skipping FFmpeg launch."
exit 1
fi

# Start FFmpeg with retry logic
echo "🎧 Starting FFmpeg stream pull..."
MAX_RETRIES=5
RETRY_COUNT=0

until ffmpeg -nostdin -loglevel info -re \
-timeout 5000000 \
-reconnect 1 \
-reconnect_streamed 1 \
-reconnect_delay_max 2 \
-i http://208.89.99.124:5004/auto/v6.1 \
-map 0:a -acodec libmp3lame -ar 44100 -b:a 192k \
-f mp3 ./wkmglive.mp3 > ./log/ffmpeg.log 2>&1; do

RETRY_COUNT=$((RETRY_COUNT+1))
echo "⚠️ FFmpeg failed (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 5s..."
sleep 5
if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
echo "❌ FFmpeg failed after $MAX_RETRIES attempts. Check ./log/ffmpeg.log"
exit 1
fi
done

echo "✅ FFmpeg is running."

# Start Ices2 to stream MP3 file to Icecast
echo "📡 Launching Ices2 for /wkmglive.mp3..."
ices2 ./ices-wkmglive.xml > ./log/ices-wkmglive.log 2>&1 &

# Optional: Start second mount stream
echo "📡 Launching Ices2 for /stream-wkmg.mp3..."
ices2 ./ices-streamwkmg.xml > ./log/ices-streamwkmg.log 2>&1 &

# Start Node backend
echo "🧠 Starting metadata backend..."
node server.js > ./log/server.log 2>&1 &

echo "✅ All services launched. Logs available in ./log/"

# Keep container alive
while true; do sleep 60; done