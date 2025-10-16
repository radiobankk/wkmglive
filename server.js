const express = require("express");
const fs = require("fs");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// 🎧 Stream source
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";

// 🧠 Metadata file path
const metadataFile = path.join(__dirname, "currentMetadata.json");

// 🎵 Default metadata (in case file is missing)
let currentMetadata = {
title: "We're Be Right Back!",
comment: "ClickOrlando / WKMG-DT1",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};

// 🔢 Trace identifiers
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

// 📣 Logging
console.log(`🧠 Starting WKMG Stream Session: ${traceLabel}`);

// 🔊 Stream pipeline
let audioStream = new PassThrough();
let ffmpegProcess;

// 🎚️ Start FFmpeg with volume boost + metadata
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-filter:a", "volume=3.0", // 3x louder audio
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", `artist=WKMG-DT1`,
"-metadata", `album=${meta.title}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => {
console.log(`⚙️ FFmpeg: ${data.toString()}`);
});

ffmpegProcess.on("exit", (code, signal) => {
console.log(`❌ FFmpeg exited with code ${code} | signal ${signal}`);
});
}

// 🚀 Start initial FFmpeg
startFFmpeg(currentMetadata);

// 🧭 Function to refresh metadata from file
function refreshMetadata() {
try {
const data = JSON.parse(fs.readFileSync(metadataFile));
if (data.title && data.comment) currentMetadata = data;
} catch (err) {
console.log("⚠️ Metadata read error:", err.message);
}
}

// 🔁 Auto-update metadata every 1 second
setInterval(refreshMetadata, 1000);

// 🧩 Helper: send metadata on new client connection
function refreshMetadataOnConnect(res) {
res.write(`ICY-MetaData: StreamTitle='${currentMetadata.title}';\n`);
}

// 🔊 Main stream endpoint
app.get("/stream-wkmg.mp3", (req, res) => {
const clientId = crypto.randomUUID();
console.log(`🔗 Client connected: ${clientId} via /stream-wkmg.mp3`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

// Refresh metadata immediately when client connects
refreshMetadataOnConnect(res);

// Pipe the live stream
audioStream.pipe(res);

req.on("close", () => {
console.log(`❌ Client disconnected: ${clientId}`);
res.end();
});
});

// 🎧 Alternate alias
app.get("/wkmglive.mp3", (req, res) => {
const clientId = crypto.randomUUID();
console.log(`🔗 Client connected: ${clientId} via /wkmglive.mp3`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

// Send current metadata again when client connects
refreshMetadataOnConnect(res);

audioStream.pipe(res);

req.on("close", () => {
console.log(`❌ Client disconnected: ${clientId}`);
res.end();
});
});

// 📡 Metadata API
app.get("/metadata", (req, res) => {
res.json({
...currentMetadata,
session: traceLabel,
timestamp: new Date().toISOString()
});
});

// 🛡️ Health check
app.get("/health", (req, res) => res.status(200).send("OK"));

// ✅ Start server
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 Live Stream Available:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});