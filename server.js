const express = require("express");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const crypto = require("crypto");
const cors = require("cors");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const fullSchedule = require("./schedule.json").schedule;

function getCurrentProgramMetadata() {
const now = new Date();
now.setHours(now.getHours() - 4); // Adjust for EDT if server is in UTC
const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[now.getDay()];
let todaySchedule = fullSchedule[today];

if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = fullSchedule[refDay];
}

if (!Array.isArray(todaySchedule)) return defaultMetadata();

for (let i = 0; i < todaySchedule.length; i++) {
const currentSlot = todaySchedule[i];
const nextSlot = todaySchedule[i + 1];

if (
currentTime >= currentSlot.time &&
(!nextSlot || currentTime < nextSlot.time)
) {
return {
title: currentSlot.title,
comment: `Now Playing: ${currentSlot.title}`,
artwork: currentSlot.artwork || "artwork/default.jpg"
};
}
}

return defaultMetadata();
}

function defaultMetadata() {
return {
title: "WKMG-DT1",
comment: "Live MP3 Relay / 192K",
artwork: "artwork/default.jpg"
};
}

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

let audioStream = new PassThrough();
let ffmpegProcess;
let activeClients = 0;

// 🎧 FFmpeg pipeline with WKMG branding and embedded artwork
function startFFmpegOnceWithInitialMetadata() {
const meta = getCurrentProgramMetadata();
const artworkPath = path.resolve(__dirname, meta.artwork);

// Fallback if artwork file doesn't exist
const artworkInput = fs.existsSync(artworkPath) ? artworkPath : path.resolve(__dirname, "artwork/default.jpg");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-timeout", "5000000",
"-rw_timeout", "15000000",
"-loglevel", "verbose",
"-i", streamUrl,
"-i", artworkInput,
"-map", "0:a",
"-map", "1:v",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-id3v2_version", "3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", "artist=WKMG-DT1",
"-metadata", "album=WKMG-DT1",
"-metadata:s:v", "title=Album cover",
"-metadata:s:v", "comment=Cover (front)",
"-f", "mp3",
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => {
console.log(`⚠️ [${traceLabel}] FFmpeg stderr:`, data.toString());
});

ffmpegProcess.on("exit", (code, signal) => {
console.log(`❌ FFmpeg exited with code: ${code}, signal: ${signal}`);
});
}

startFFmpegOnceWithInitialMetadata();

// 🔊 WKMG stream endpoint
app.get("/stream-wkmg.mp3", (req, res) => {
const clientId = crypto.randomUUID();
activeClients++;
console.log(`🔗 [${traceLabel}] Client connected: ${req.ip} | ID: ${clientId}`);
console.log(`👥 Active clients: ${activeClients}`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

req.setTimeout(0);
audioStream.pipe(res);

req.on("close", () => {
activeClients--;
console.log(`❌ [${traceLabel}] Client disconnected: ${req.ip} | ID: ${clientId}`);
console.log(`👥 Active clients: ${activeClients}`);
});

res.on("error", () => {
console.log(`⚠️ [${traceLabel}] Stream error for client ${clientId}`);
});
});

// 🔁 Alias route: /wkmglive.mp3
app.get("/wkmglive.mp3", (req, res) => {
const clientId = crypto.randomUUID();
activeClients++;
console.log(`🔗 [${traceLabel}] Client connected via /wkmglive.mp3: ${req.ip} | ID: ${clientId}`);
console.log(`👥 Active clients: ${activeClients}`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

req.setTimeout(0);
audioStream.pipe(res);

req.on("close", () => {
activeClients--;
console.log(`❌ [${traceLabel}] /wkmglive.mp3 client disconnected: ${req.ip} | ID: ${clientId}`);
console.log(`👥 Active clients: ${activeClients}`);
});

res.on("error", () => {
console.log(`⚠️ [${traceLabel}] Stream error for client ${clientId}`);
});
});

// 🛡️ Health check
app.get("/health", (req, res) => {
res.status(200).send("OK");
});

// 📊 Metadata endpoint (dynamic)
app.get("/metadata", (req, res) => {
const meta = getCurrentProgramMetadata();
res.json({
...meta,
album: "WKMG-DT1",
artist: "WKMG-DT1",
source: streamUrl,
session: traceLabel,
timestamp: new Date().toISOString(),
activeClients
});
});

// 🔊 MP3 stream health check
app.get("/mp3-health", (req, res) => {
const isStreamActive = !audioStream.destroyed && ffmpegProcess.exitCode === null;

res.json({
status: isStreamActive ? "OK" : "ERROR",
streamActive: isStreamActive,
activeClients,
session: traceLabel,
timestamp: new Date().toISOString()
});
});

// 🧼 Graceful shutdown
process.on("SIGINT", () => {
console.log(`🛑 [${traceLabel}] SIGINT received. Shutting down...`);
audioStream.end();
process.exit();
});

process.on("SIGTERM", () => {
console.log(`🛑 [${traceLabel}] SIGTERM received. Terminating...`);
audioStream.end();
process.exit();
});

// ✅ Start server
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 MP3 stream available at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});
