const express = require("express");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const crypto = require("crypto");
const cors = require("cors");
const ffmpegPath = require("ffmpeg-static");
const fullSchedule = require("./schedule.json").schedule;

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// === Stream Info ===
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;
console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

// === Schedule Normalization ===
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (fullSchedule[day] === "same as Monday") {
fullSchedule[day] = fullSchedule["Monday"];
}
});

// === Default Metadata ===
function defaultMetadata() {
return {
title: "We're Be Right Back!",
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};
}

// === Get Current Program Metadata ===
function getCurrentProgramMetadata() {
const now = new Date();
now.setHours(now.getHours() - 4); // EDT adjustment
const currentTime = now.toTimeString().slice(0, 5);
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
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
artwork: defaultMetadata().artwork
};
}
}

return defaultMetadata();
}

// === FFmpeg Stream Setup ===
let audioStream = new PassThrough();
let ffmpegProcess;
let activeClients = 0;
let currentMetadata = defaultMetadata();

function startFFmpeg(meta) {
ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-timeout", "5000000",
"-rw_timeout", "15000000",
"-loglevel", "verbose",
"-i", streamUrl,
"-vn",
"-af", "volume=3.0",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `artist=${meta.artist}`,
"-metadata", `comment=${meta.comment}`,
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

startFFmpeg(currentMetadata);

// === Stream Endpoints ===
function handleStream(req, res, routeLabel) {
const clientId = crypto.randomUUID();
activeClients++;
console.log(`🔗 [${traceLabel}] Client connected via ${routeLabel}: ${req.ip} | ID: ${clientId}`);
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
}

app.get("/stream-wkmg.mp3", (req, res) => handleStream(req, res, "/stream-wkmg.mp3"));
app.get("/wkmglive.mp3", (req, res) => handleStream(req, res, "/wkmglive.mp3"));

// === Metadata Endpoint ===
app.get("/metadata", (req, res) => {
res.json({
title: currentMetadata.title,
artist: currentMetadata.artist,
comment: currentMetadata.comment,
artwork: currentMetadata.artwork,
source: streamUrl,
session: traceLabel,
timestamp: new Date().toISOString(),
activeClients
});
});

// === Health Check ===
app.get("/health", (req, res) => res.status(200).send("OK"));

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

// === Metadata Watcher (every second) ===
setInterval(() => {
const newMeta = getCurrentProgramMetadata();
currentMetadata = newMeta;

// Optional: write to file for debugging or frontend polling
require("fs").writeFileSync(
"./currentMetadata.json",
JSON.stringify({ ...newMeta, timestamp: new Date().toISOString() }, null, 2)
);
}, 1000);

// === Graceful Shutdown ===
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

// === Start Server ===
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 MP3 stream available at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});