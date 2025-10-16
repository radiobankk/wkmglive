const express = require("express");
const fs = require("fs");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const crypto = require("crypto");

// 🚀 Constants
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// Stream pipeline
let audioStream = new PassThrough();
let ffmpegProcess;

// Initial metadata
let currentMetadata = {
title: "WKMG-DT1 News 6",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};

// 📡 Function to start FFmpeg with current metadata and boost volume
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-filter:a", "volume=2.0", // 🔊 boost volume 2x
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", `artwork=${meta.artwork}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data =>
console.log(`⚠️ [FFmpeg] ${data.toString()}`)
);

ffmpegProcess.on("exit", (code, signal) =>
console.log(`❌ FFmpeg exited: ${code} | ${signal}`)
);
}

// Start initial FFmpeg
startFFmpeg(currentMetadata);

// 📊 Metadata updater function
function updateMetadata() {
try {
const meta = JSON.parse(fs.readFileSync("./currentMetadata.json"));

// Only restart FFmpeg if metadata actually changed
if (
meta.title !== currentMetadata.title ||
meta.comment !== currentMetadata.comment ||
meta.artwork !== currentMetadata.artwork
) {
console.log(`🔁 Updating metadata: ${meta.title}`);
currentMetadata = meta;
startFFmpeg(currentMetadata); // seamless restart
}
} catch (err) {
console.error("❌ Failed to read metadata:", err);
}
}

// 🔄 Update metadata every 1 second for permanent live display
setInterval(updateMetadata, 1000);

// 🔊 Stream endpoint
app.get("/stream-wkmg.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

audioStream.pipe(res);

req.on("close", () => res.end());
});

// 🔗 Alias endpoint
app.get("/wkmglive.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

audioStream.pipe(res);

req.on("close", () => res.end());
});

// 🖼 Metadata endpoint
app.get("/metadata", (req, res) => {
res.json({
...currentMetadata,
session: traceLabel,
timestamp: new Date().toISOString()
});
});

// ✅ Start server
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG MP3 stream running at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`Metadata updates every 1 second from currentMetadata.json`);
});