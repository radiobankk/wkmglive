const express = require("express");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const crypto = require("crypto");
const cors = require("cors");
const ffmpegPath = require("ffmpeg-static");
const fullSchedule = require("./schedule.json").schedule;

function getCurrentProgramMetadata() {
const now = new Date();
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[now.getDay()];
const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

let todaySchedule = fullSchedule[today];

// Handle "same as Monday" references
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = fullSchedule[refDay];
}

if (!Array.isArray(todaySchedule)) return defaultMetadata();

const sortedSlots = todaySchedule
.filter(slot => slot.time <= currentTime)
.sort((a, b) => b.time.localeCompare(a.time));

if (sortedSlots.length > 0) {
const currentSlot = sortedSlots[0];
return {
title: currentSlot.title,
artist: "WKMG-DT1 NEWS 6",
comment: `Now Playing: ${currentSlot.title}`
};
}

return defaultMetadata();
}

function defaultMetadata() {
return {
title: "WKMG-DT1 NEWS 6",
artist: "WKMG-DT1 NEWS 6",
comment: "Live MP3 Relay / 192K"
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

// 🎧 FFmpeg pipeline with WKMG branding
function startFFmpeg() {
ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-timeout", "5000000",
"-rw_timeout", "15000000",
"-loglevel", "verbose",
"-i", streamUrl,
"-vn",
"-c:a", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", "title=currentSlot.title",
"-metadata", "artist=WKMG-DT1 NEWS 6",
"-metadata", "comment=Live MP3 Relay / 192K",
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => {
console.log(`📣 [${traceLabel}] FFmpeg stderr:`, data.toString());
});

ffmpegProcess.on("close", code => {
console.log(`❌ [${traceLabel}] FFmpeg exited with code ${code}`);
setTimeout(startFFmpeg, 5000); // Retry after delay
});
}

startFFmpeg();

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

req.setTimeout(0); // Disable default timeout
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
album: meta.artist,
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

app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 MP3 stream available at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});