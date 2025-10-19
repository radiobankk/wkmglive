#!/bin/bash

# Start Icecast using correct binary path
icecast -c ./icecast.xml &

# Wait briefly to ensure Icecast is ready
sleep 2

# Start your Node backend
node server.js
