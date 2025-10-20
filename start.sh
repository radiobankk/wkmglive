#!/bin/bash

echo "🚀 Starting WKMGLIVE Broadcast Backend..."

# Start Icecast with privilege drop
echo "📡 Launching Icecast..."
icecast2 -c ./icecast.xml &
sleep 2

# Confirm Icecast is listening
if command -v curl > /dev/null; then
echo "🔍 Checking Icecast health..."
curl --silent --max-time 5 http://wkmglive.onrender.com:10000/status.xsl > /dev/null
if [ $? -ne 0 ]; then
echo "❌ Icecast failed to start or is unreachable on port 10000"
exit 1
fi
echo "✅ Icecast is live."
else
echo "⚠️ Skipping health check — curl not installed"
fi

# Start FFmpeg to pull stream and write to file
echo "🎧 Starting FFmpeg stream pull..."
ffmpeg -re -i http://208.89.99.124:5004/auto/v6.1 \
-map 0:a -acodec libmp3lame -ar 44100 -b:a 192k \
-f mp3 ./wkmglive.mp3 > ./log/ffmpeg.log 2>&1 &

FFMPEG_PID=$!
sleep 2

# Monitor FFmpeg health
if ! ps -p $FFMPEG_PID > /dev/null; then
echo "❌ FFmpeg exited unexpectedly. Check ./log/ffmpeg.log"
exit 1
fi
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