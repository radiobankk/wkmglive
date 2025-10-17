const express = require("express");
const fs = require("fs");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const moment = require("moment-timezone");
const crypto = require("crypto");
const scheduleData = require("./schedule.json");
const artworkData = require("./artwork.json").artwork;

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// === Stream info ===
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;
console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

// === Schedule normalization ===
const schedule = scheduleData.schedule;
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") schedule[day] = schedule["Monday"];
});

// === Audio stream setup ===
let audioStream = new PassThrough();
let ffmpegProcess;
let lastTitle = null;

// === Start FFmpeg ===
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-af", "volume=3.0",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => console.log(`⚠️ [FFmpeg] ${data}`));
ffmpegProcess.on("exit", (code, signal) =>
console.log(`❌ FFmpeg exited: ${code} | ${signal}`)
);
}

// === Get Artwork by Title ===
function getArtworkUrl(title) {
const match = artworkData.find(item => item.title === title);
return match ? match.url : currentMetadata.artwork;
}

// === Get Current Program Metadata ===
function getCurrentProgramMetadata() {
const now = moment().tz("America/New_York");
const currentDay = now.format("dddd");
const currentTime = now.format("HH:mm");

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];

let activeProgram = {
title: "NEWS 6",
comment: "ClickOrlando / WKMG-DT1",
artwork: currentMetadata.artwork,
station: "WKMG-DT1"
};

for (const slot of todaySchedule) {
if (slot.time <= currentTime) {
activeProgram.title = slot.title;
activeProgram.comment = `Now Playing: ${slot.title}`;
activeProgram.artwork = getArtworkUrl(slot.title);
} else {
break;
}
}

return activeProgram;
}

// === Metadata updater (1-second refresh) ===
setInterval(() => {
const newMetadata = getCurrentProgramMetadata();

if (newMetadata.title !== lastTitle) {
lastTitle = newMetadata.title;
startFFmpeg(newMetadata);
console.log(`🔁 Metadata updated: ${newMetadata.title}`);
}

currentMetadata = newMetadata;

fs.writeFileSync(
"./currentMetadata.json",
JSON.stringify({ ...newMetadata, timestamp: new Date().toISOString() }, null, 2)
);
}, 1000);

// === Streaming Endpoints ===
function streamEndpoint(req, res) {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});
audioStream.pipe(res);
req.on("close", () => res.end());
}

app.get("/stream-wkmg.mp3", streamEndpoint);
app.get("/wkmglive.mp3", streamEndpoint);

// === Metadata Endpoint ===
app.get("/metadata", (req, res) => {
res.json({
...currentMetadata,
timestamp: new Date().toISOString(),
session: traceLabel
});
});

// === Health Check ===
app.get("/health", (req, res) => res.status(200).send("OK"));

// === Start Server ===
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG MP3 stream available at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`Metadata updates every second from schedule.json`);
});