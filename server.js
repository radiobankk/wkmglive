const express = require("express");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const moment = require("moment-timezone");
const crypto = require("crypto");
const scheduleData = require("./schedule.json");

// -------------------- CONFIG --------------------
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

console.log(`🧠 Starting WKMG stream trace: ${traceLabel}`);

// Initial metadata
let currentMetadata = {
title: "WKMG-DT1 NEWS 6",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&",
station: "WKMG-DT1"
};

// -------------------- UTILITY --------------------
function getCurrentProgram() {
const now = moment().tz("America/New_York");
const currentTime = now.format("HH:mm");
const currentDay = now.format("dddd");

// Resolve "same as Monday"
const schedule = scheduleData.schedule;
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") schedule[day] = schedule["Monday"];
});

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];
if (!todaySchedule.length) return currentMetadata;

// Find the latest program that started before current time
let activeProgram = todaySchedule[0];
for (const program of todaySchedule) {
if (program.time <= currentTime) activeProgram = program;
}

return {
title: activeProgram.title,
comment: `Now Playing: ${activeProgram.title}`,
artwork: activeProgram.artwork || currentMetadata.artwork,
station: "WKMG-DT1"
};
}

// -------------------- STREAM --------------------
let audioStream = new PassThrough();
let ffmpegProcess;

function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-af", "volume=2.0", // <-- volume boost
"-f", "mp3",
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });
ffmpegProcess.stderr.on("data", data => console.log(data.toString()));
ffmpegProcess.on("exit", (code, signal) => console.log(`FFmpeg exited: ${code} | ${signal}`));
}

startFFmpeg(currentMetadata);

// -------------------- ENDPOINTS --------------------
app.get("/stream-wkmg.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});
audioStream.pipe(res);
req.on("close", () => res.end());
});

app.get("/wkmglive.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});
audioStream.pipe(res);
req.on("close", () => res.end());
});

app.get("/metadata", (req, res) => {
currentMetadata = getCurrentProgram();
res.json(currentMetadata);
});

// -------------------- METADATA UPDATER --------------------
setInterval(() => {
currentMetadata = getCurrentProgram();
}, 1000); // update every second

// -------------------- SERVER --------------------
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG-DT1 MP3 stream available at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`🟢 Metadata endpoint: http://${HOST}:${PORT}/metadata`);
});