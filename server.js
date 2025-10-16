const express = require("express");
const fs = require("fs");
const path = require("path");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");
const crypto = require("crypto");
const moment = require("moment-timezone");
const scheduleData = require("./schedule.json");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// ------------------- Stream Info -------------------
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = crypto.randomUUID();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const traceLabel = `WKMG-Session-${sessionId}-${timestamp}`;

let audioStream = new PassThrough();
let ffmpegProcess;

// ------------------- Helper: Get Current Metadata -------------------
function getCurrentMetadata() {
const now = moment().tz("America/New_York");
const currentDay = now.format("dddd");
const currentTime = now.format("HH:mm");

const schedule = scheduleData.schedule;
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") schedule[day] = schedule["Monday"];
});

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];
let activeProgram = todaySchedule[0] || { title: "Live Stream", artwork: "" };

for (const show of todaySchedule) {
if (show.time <= currentTime) activeProgram = show;
}

return {
title: activeProgram.title,
comment: `Now Playing: ${activeProgram.title} | WKMG-DT1`,
artwork: activeProgram.artwork || "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&",
station: "WKMG-DT1",
timestamp: now.format("YYYY-MM-DD HH:mm:ss")
};
}

// ------------------- Start FFmpeg -------------------
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-af", "volume=2.0", // Volume boost
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => console.log(`FFmpeg: ${data.toString()}`));
ffmpegProcess.on("exit", (code, signal) => console.log(`FFmpeg exited: ${code} | ${signal}`));
}

// Start initial FFmpeg
let currentMetadata = getCurrentMetadata();
startFFmpeg(currentMetadata);

// ------------------- Metadata Updater -------------------
setInterval(() => {
const meta = getCurrentMetadata();
const hasChanged = meta.title !== currentMetadata.title || meta.comment !== currentMetadata.comment || meta.artwork !== currentMetadata.artwork;

if (hasChanged) {
console.log(`[${meta.timestamp}] Updating metadata: ${meta.title}`);
currentMetadata = meta;
startFFmpeg(currentMetadata);
}

// Save current metadata to JSON for external access
fs.writeFileSync(path.join(__dirname, "currentMetadata.json"), JSON.stringify(currentMetadata, null, 2));
}, 1000); // every 1 second

// ------------------- Stream Endpoints -------------------
function attachStreamEndpoint(route) {
app.get(route, (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

audioStream.pipe(res);

req.on("close", () => res.end());
});
}

attachStreamEndpoint("/stream-wkmg.mp3");
attachStreamEndpoint("/wkmglive.mp3");

// ------------------- Metadata Endpoint -------------------
app.get("/metadata", (req, res) => {
res.json(currentMetadata);
});

// ------------------- Start Server -------------------
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG MP3 streams running:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`📡 Metadata available at: http://${HOST}:${PORT}/metadata`);
});