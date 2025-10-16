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

const STATION_NAME = "WKMG News 6";
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const artworkUrl = "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&";

const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

let audioStream = new PassThrough();
let ffmpegProcess;
let activeClients = 0;
let lastMetadata = null;

// 🕒 Determine current program metadata
function getCurrentProgramMetadata() {
const now = new Date();
now.setHours(now.getHours() - 4); // EDT adjustment
const currentTime = now.toTimeString().slice(0, 5); // HH:MM
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = days[now.getDay()];
let todaySchedule = fullSchedule[today];

// Handle “same as Monday”
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = fullSchedule[refDay];
}

if (!Array.isArray(todaySchedule)) return defaultMetadata();

for (let i = 0; i < todaySchedule.length; i++) {
const current = todaySchedule[i];
const next = todaySchedule[i + 1];
if (currentTime >= current.time && (!next || currentTime < next.time)) {
const meta = {
title: current.title,
artist: STATION_NAME,
comment: `Now Playing: ${current.title}`,
artwork: artworkUrl // 👈 Custom artwork for all programs
};
lastMetadata = meta;
return meta;
}
}

return defaultMetadata();
}

function defaultMetadata() {
return (
lastMetadata || {
title: "WKMG-DT1 NEWS 6",
artist: STATION_NAME,
comment: "Live MP3 Relay / 192K",
artwork: artworkUrl // 👈 Default artwork too
}
);
}

// 🎧 Start FFmpeg stream (persistent)
function startFFmpeg() {
const meta = getCurrentProgramMetadata();
console.log(`▶️ Starting FFmpeg stream with initial metadata: ${meta.title}`);

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-timeout", "5000000",
"-rw_timeout", "15000000",
"-loglevel", "warning",
"-i", streamUrl,
"-vn",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `artist=${meta.artist}`,
"-metadata", `comment=${meta.comment}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.on("exit", (code, signal) => {
console.log(`⚠️ FFmpeg exited: code ${code}, signal ${signal}`);
});
}

startFFmpeg();

// 🎵 Audio endpoints
function handleClientConnection(req, res, routeName) {
const clientId = crypto.randomUUID();
activeClients++;
console.log(`🔗 Client via ${routeName}: ${req.ip} (${clientId})`);
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
console.log(`❌ Disconnected (${clientId})`);
console.log(`👥 Active clients: ${activeClients}`);
});
}

app.get("/stream-wkmg.mp3", (req, res) => handleClientConnection(req, res, "/stream-wkmg.mp3"));
app.get("/wkmglive.mp3", (req, res) => handleClientConnection(req, res, "/wkmglive.mp3"));

// 🧠 Metadata JSON endpoint
app.get("/metadata", (req, res) => {
const meta = getCurrentProgramMetadata();
res.json({
title: meta.title,
artist: meta.artist,
artwork: meta.artwork,
comment: meta.comment,
source: streamUrl,
activeClients,
session: traceLabel,
timestamp: new Date().toISOString()
});
});

// 🩺 Health
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/mp3-health", (req, res) => {
const active = !audioStream.destroyed && ffmpegProcess.exitCode === null;
res.json({
status: active ? "OK" : "ERROR",
activeClients,
session: traceLabel,
timestamp: new Date().toISOString()
});
});

// 🧼 Cleanup
process.on("SIGINT", () => {
console.log("🛑 SIGINT — shutting down...");
audioStream.end();
process.exit();
});
process.on("SIGTERM", () => {
console.log("🛑 SIGTERM — terminating...");
audioStream.end();
process.exit();
});

app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 MP3 stream live at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});
