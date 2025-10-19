#!/bin/bash
icecast -c /etc/icecast2/icecast.xml &
node server.js
