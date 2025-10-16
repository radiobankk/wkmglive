const express = require("express");
const fs = require("fs");
const path = require("path");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");
const moment = require("moment-timezone");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// --- File paths ---
const SCHEDULE_FILE = path.join(__dirname, "schedule.json");
const ARTWORK_FILE = path.join(__dirname, "artwork.json");
const METADATA_FILE = path.join(__dirname, "currentMetadata.json");

// --- Stream setup ---
const STREAM_URL = "http://208.89.99.124:5004/auto/v6.1";
let audioStream = new PassThrough();
let ffmpegProcess = null;

// --- Default metadata ---
let currentMetadata = {
title: "Live Stream",
artist: "WKMG-DT1 NEWS 6",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png",
comment: "Live MP3 Relay / 192K"
};

// --- Helpers ---
function log(message) {
console.log(`[${new Date().toISOString()}] ${message}`);
}

function loadSchedule() {
try {
return require(SCHEDULE_FILE).schedule || {};
} catch (err) {
log(`⚠️ Schedule load error: ${err.message}`);
return {};
}
}

function loadArtwork() {
try {
return require(ARTWORK_FILE);
} catch (err) {
log(`⚠️ Artwork load error: ${err.message}`);
return {};
}
}

// Convert "HH:mm" to total minutes since midnight
function timeToMinutes(timeStr) {
const [hh, mm] = timeStr.split(":").map(Number);
return hh * 60 + mm;
}

// --- Determine active show with previous-day late-night handling ---
function getActiveShow(schedule) {
const now = moment().tz("America/New_York");
const nowMinutes = now.hours() * 60 + now.minutes();
const currentDay = now.format("dddd");
const previousDay = now.clone().subtract(1, "day").format("dddd");

// Resolve "same as Monday"
let todaySchedule = schedule[currentDay];
if (["Tuesday","Wednesday","Thursday","Friday"].includes(currentDay) && todaySchedule === "same as Monday") {
todaySchedule = schedule["Monday"];
}
todaySchedule = Array.isArray(todaySchedule) ? todaySchedule : [];

let prevSchedule = schedule[previousDay];
if (["Tuesday","Wednesday","Thursday","Friday"].includes(previousDay) && prevSchedule === "same as Monday") {
prevSchedule = schedule["Monday"];
}
prevSchedule = Array.isArray(prevSchedule) ? prevSchedule : [];

// Include previous day's late-night shows (after 00:00 but before first show of today)
const firstTodayTime = todaySchedule[0] ? timeToMinutes(todaySchedule[0].time) : 180; // default 03:00
const prevLateNight = prevSchedule.filter(s => timeToMinutes(s.time) < firstTodayTime);

const combinedSchedule = [...prevLateNight, ...todaySchedule]
.map(s => ({ ...s, minutes: timeToMinutes(s.time) }))
.sort((a, b) => a.minutes - b.minutes);

// Find last show before now
let activeShow = { title: "Live Stream" };
for (const show of combinedSchedule) {
if (show.minutes <= nowMinutes) activeShow = show;
}

return activeShow;
}

// --- Update metadata based on schedule & artwork ---
function updateMetadata() {
const schedule = loadSchedule();
const artworkData = loadArtwork();
const activeShow = getActiveShow(schedule);

const matchedArtwork = artworkData[activeShow.title];
const artworkUrl = matchedArtwork ? matchedArtwork.artwork : currentMetadata.artwork;

currentMetadata = {
title: activeShow.title,
artist: "WKMG-DT1 NEWS 6",
artwork: artworkUrl,
comment: "Live MP3 Relay / 192K",
timestamp: moment().tz("America/New_York").format("YYYY-MM-DD HH:mm:ss")
};

fs.writeFileSync(METADATA_FILE, JSON.stringify(currentMetadata, null, 2));
log(`Metadata updated: ${currentMetadata.title}`);
}

// --- Start FFmpeg ---
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");
audioStream = new PassThrough();

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", STREAM_URL,
"-vn",
"-filter:a", "volume=3.0",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", `artist=${meta.artist}`,
"-metadata", `album=${meta.title}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => log(`FFmpeg: ${data.toString().trim()}`));
ffmpegProcess.on("exit", (code, signal) => log(`FFmpeg exited (code: ${code}, signal: ${signal})`));
}

// --- Auto-update metadata every 10 seconds ---
updateMetadata();
startFFmpeg(currentMetadata);

setInterval(() => {
const oldTitle = currentMetadata.title;
updateMetadata();
if (currentMetadata.title !== oldTitle) {
log(`Show changed: restarting FFmpeg for "${currentMetadata.title}"`);
startFFmpeg(currentMetadata);
}
}, 10000);

// --- Client handler ---
function handleClient(req, res) {
const clientId = crypto.randomUUID();
log(`Client connected: ${clientId} (${req.url})`);

res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});

res.write(`ICY-MetaData: StreamTitle='${currentMetadata.title}';\n`);

audioStream.pipe(res);

req.on("close", () => {
log(`Client disconnected: ${clientId}`);
res.end();
});
}

// --- Express endpoints ---
app.get("/stream-wkmg.mp3", handleClient);
app.get("/wkmglive.mp3", handleClient);
app.get("/metadata", (req, res) => res.json(currentMetadata));
app.get("/health", (req, res) => res.status(200).send("OK"));

// --- Start server ---
app.listen(PORT, HOST, () => {
log(`WKMG-DT1 Live Stream Available:`);
log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
});