const express = require("express");
const fs = require("fs");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const moment = require("moment-timezone");
const crypto = require("crypto");
const scheduleData = require("./schedule.json");

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

// === Schedule handling ===
const schedule = scheduleData.schedule;
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") schedule[day] = schedule["Monday"];
});

// === Audio stream setup ===
let audioStream = new PassThrough();
let ffmpegProcess;

// Default metadata
let currentMetadata = {
title: "WKMG-DT1 NEWS 6",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&",
station: "WKMG-DT1"
};

// === Start FFmpeg ===
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-af", "volume=3.0", // 🔊 Triple volume boost
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

startFFmpeg(currentMetadata);

// === Get Current Program ===
function getCurrentProgramMetadata() {
const now = moment().tz("America/New_York");
const currentDay = now.format("dddd");
const currentTime = now.format("HH:mm");

let todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];

let activeProgram = {
title: "Live Stream",
comment: "Live MP3 Relay / 192K",
artwork: currentMetadata.artwork,
station: "WKMG-DT1"
};

for (const slot of todaySchedule) {
if (slot.time <= currentTime) {
activeProgram.title = slot.title;
activeProgram.comment = `Now Playing: ${slot.title}`;
activeProgram.artwork = slot.artwork || currentMetadata.artwork;
} else {
break;
}
}

return activeProgram;
}

// === Metadata updater (1-second refresh) ===
setInterval(() => {
currentMetadata = getCurrentProgramMetadata();

// Optional: write for debugging
fs.writeFileSync(
"./currentMetadata.json",
JSON.stringify(currentMetadata, null, 2)
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
console.log(`Metadata updates every 1 second from schedule.json`);
});