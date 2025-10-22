#!/bin/bash

echo "🚀 Starting WKMGLIVE Broadcast Backend..."

# Trap to clean up background processes on exit
trap 'kill $(jobs -p)' EXIT

# Check upstream stream availability
echo "🔎 Checking upstream stream availability..."
if ! curl --silent --head --fail http://208.89.99.124:5004/auto/v6.1 > /dev/null; then
echo "❌ Upstream stream is unreachable. Skipping FFmpeg launch."
else
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
-map 0:1 -ac 2 -acodec libmp3lame -ar 44100 -b:a 192k \
-f mp3 ./wkmglive.mp3 > ./log/ffmpeg.log 2>&1; do

RETRY_COUNT=$((RETRY_COUNT+1))
echo "⚠️ FFmpeg failed (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 5s..."
sleep 5
if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
echo "❌ FFmpeg failed after $MAX_RETRIES attempts. Check ./log/ffmpeg.log"
break
fi
done

echo "✅ FFmpeg is running."
fi

# Start Ices2 for both mounts
echo "📡 Launching Ices2 for /wkmglive.mp3..."
ices2 ./ices-wkmglive.xml > ./log/ices-wkmglive.log 2>&1 &

echo "📡 Launching Ices2 for /stream-wkmg.mp3..."
ices2 ./ices-streamwkmg.xml > ./log/ices-streamwkmg.log 2>&1 &

# Start Node backend
echo "🧠 Starting metadata backend..."
node server.js > ./log/server.log 2>&1 &

# Launch Icecast in foreground as PID 1
echo "📡 Launching Icecast as PID 1..."
exec icecast2 -c ./icecast.xml