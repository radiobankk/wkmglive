const express = require("express");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// Stream source
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const sessionId = Math.floor(Math.random() * 1000000);
const traceLabel = "WKMG-LIVE";
const startTimestamp = new Date().toISOString();

let audioStream = new PassThrough();
let ffmpegProcess;
let currentMetadata = {};
let listenerCount = 0;

// Load schedule for auto-detect
const scheduleData = require("./schedule.json");

// 🔍 Determine active show directly from schedule
function getActiveShowFromSchedule() {
const now = moment().tz("America/New_York");
const currentDay = now.format("dddd");
const currentTime = now.format("HH:mm");

const schedule = scheduleData.schedule;
// Resolve "same as Monday"
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") {
schedule[day] = schedule["Monday"];
}
});

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];
let activeShow = "WKMG-DT1 Live Stream";

for (let i = 0; i < todaySchedule.length; i++) {
const show = todaySchedule[i];
const nextShow = todaySchedule[i + 1];
if (currentTime >= show.time && (!nextShow || currentTime < nextShow.time)) {
activeShow = show.title;
break;
}
}

return {
title: We're Be Right Back!,
artist: "WKMG-DT1",
comment: "ClickOrlando / WKMG-DT1",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&",
timestamp: now.format("YYYY-MM-DD HH:mm:ss")
};
}

// 🎧 Start FFmpeg stream
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

console.log(`🎵 Starting FFmpeg for "${meta.title}"...`);

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-filter:a", "volume=3.0", // louder volume
"-vn",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `artist=${meta.artist}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", `TPE1=${meta.artist}`,
"-metadata", `TALB=${meta.title}`,
"-metadata", `artwork=${meta.artwork}`,
"pipe:1"
]);

audioStream = new PassThrough();
ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => {
const msg = data.toString();
if (msg.includes("Metadata:")) console.log(`🧠 FFmpeg Metadata Updated → ${meta.title}`);
});

ffmpegProcess.on("exit", (code, signal) => {
console.log(`⚠️ FFmpeg exited (code: ${code}, signal: ${signal})`);
});
}

// 🧠 Load initial metadata (auto-detect active program)
function loadInitialMetadata() {
try {
const metaFile = JSON.parse(fs.readFileSync(path.join(__dirname, "currentMetadata.json")));
if (metaFile && metaFile.title) {
currentMetadata = metaFile;
console.log(`📡 Loaded metadata from currentMetadata.json → ${metaFile.title}`);
return;
}
} catch {
console.log("⚙️ No valid currentMetadata.json found, detecting active program from schedule...");
}

currentMetadata = getActiveShowFromSchedule();
console.log(`🕓 Auto-detected initial program → ${currentMetadata.title}`);
}

loadInitialMetadata();
startFFmpeg(currentMetadata);

// 🔊 Stream endpoint
app.get("/wkmglive.mp3", (req, res) => {
listenerCount++;
console.log(`🎧 New listener connected | Total: ${listenerCount}`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

// Always refresh metadata for each new client
startFFmpeg(currentMetadata);

audioStream.pipe(res);
req.on("close", () => {
listenerCount--;
console.log(`👋 Listener disconnected | Total: ${listenerCount}`);
res.end();
});
});

// 📄 Metadata JSON
app.get("/metadata", (req, res) => {
res.json({
...currentMetadata,
sessionId,
traceLabel,
startTimestamp,
listenerCount
});
});

// 🩺 Simple status page for debugging
app.get("/status", (req, res) => {
res.send(`
<h2>WKMG Live Stream Status</h2>
<p><strong>Now Playing:</strong> ${currentMetadata.title}</p>
<p><strong>Station:</strong> ${currentMetadata.artist}</p>
<p><strong>Listeners:</strong> ${listenerCount}</p>
<p><strong>Updated:</strong> ${currentMetadata.timestamp}</p>
<p><strong>Session:</strong> ${traceLabel}-${sessionId}</p>
<img src="${currentMetadata.artwork}" alt="artwork" width="200"/>
`);
});

// 🔁 Refresh metadata from file or schedule every second
setInterval(() => {
try {
const meta = JSON.parse(fs.readFileSync("./currentMetadata.json"));
if (JSON.stringify(meta) !== JSON.stringify(currentMetadata)) {
console.log(`🔁 Metadata updated: ${meta.title}`);
currentMetadata = meta;
startFFmpeg(currentMetadata);
}
} catch {
// fallback to live schedule detection if JSON missing
const detected = getActiveShowFromSchedule();
if (detected.title !== currentMetadata.title) {
console.log(`📅 Auto-updated from schedule → ${detected.title}`);
currentMetadata = detected;
startFFmpeg(currentMetadata);
}
}
}, 1000);

// 🚀 Start server
app.listen(PORT, HOST, () => {
console.log(`✅ WKMG live at: http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`ℹ️ Metadata: http://${HOST}:${PORT}/metadata`);
console.log(`📊 Status: http://${HOST}:${PORT}/status`);
});