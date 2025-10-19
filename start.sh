#!/bin/bash

# Start Icecast with privilege drop
icecast2 -c ./icecast.xml &
sleep 2

# Start FFmpeg to pull stream and write to file
ffmpeg -re -i http://208.89.99.124:5004/auto/v6.1 \
-map 0:a -acodec libmp3lame -ar 44100 -b:a 192k \
-f mp3 ./wkmglive.mp3 &

# Wait for FFmpeg to start writing
sleep 2

# Start Ices2 to stream MP3 file to Icecast
ices2 ./ices-playback.xml &

# Start Node backend
node server.js
