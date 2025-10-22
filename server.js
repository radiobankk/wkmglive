const express = require("express");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const request = require("request");

// === Config ===
const ffmpegPath = "ffmpeg";
const ICECAST_HOST = "wkmglive.onrender.com"; // Internal container access
const ICECAST_PORT = process.env.ICECAST_PORT || 10000;
const ICECAST_USER = "wherejah";
const ICECAST_PASS = "Jjbutter12";

const mounts = [
{ path: "/wkmglive.mp3", genre: "Television" },
{ path: "/stream-wkmg.mp3", genre: "Television" }
];

// === Load schedule and artwork ===
let scheduleData = { schedule: {} };
try {
scheduleData = JSON.parse(fs.readFileSync("schedule.json", "utf8"));
} catch (err) {
console.warn("⚠️ Failed to load schedule.json:", err.message);
}

const artworkMap = (() => {
try {
return require("./artwork.json");
} catch {
return {};
}
})();

const fallback = {
title: "We're Be Right Back!",
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
genre: "Television",
artwork: artworkMap["We're Be Right Back!"] || ""
};

// === Commercial break patterns ===
const breakPatterns = {
"CBS News Roundup": [7, 14],
"CBS News Mornings": [7, 14, 21, 28],
"News 6 Mornings at 5am": [7, 14, 21, 28, 36, 44],
"News 6 Mornings at 6am": [7, 14, 21, 28, 36, 44],
"CBS Mornings": [12, 24, 36, 48, 72, 84, 96, 108],
"Entertainment Tonight": [7, 17, 27],
"Inside Edition": [7, 17, 27],
"Let's Make a Deal": [12, 24, 36, 48],
"The Price Is Right": [12, 24, 36, 48],
"News 6 at Noon": [7, 14, 21, 28],
"The Young and the Restless": [7, 17, 27],
"The Bold and the Beautiful": [7, 17, 27],
"Beyond the Gates": [12, 24, 36, 48],
"The Drew Barrymore Show": [12, 24, 36, 48],
"News 6 at 4pm": [7, 14, 21, 28, 36, 44],
"News 6 at 5pm": [7, 14, 21, 28, 36, 44],
"News 6 at 6pm": [7, 14, 21, 28],
"CBS Evening News": [7, 14, 21, 28],
"News 6 At 11pm": [7, 14, 21, 28],
"The Late Show with Stephen Colbert": [12, 25, 38, 51],
"Comics Unleashed with Byron Allen": [7, 17, 27],
"Paid Programming": [10, 22]
};

// === Utilities ===
function addMinutes(time, mins) {
const [h, m] = time.split(":").map(Number);
const date = new Date(2000, 0, 1, h, m + mins);
return date.toTimeString().slice(0, 5);
}

function getScheduleForToday() {
const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
const base = scheduleData.schedule[day] === "same as Monday"
? scheduleData.schedule["Monday"]
: scheduleData.schedule[day] || [];

return base.flatMap(block => {
const breaks = breakPatterns[block.title] || [];
const injected = breaks.map(offset => ({
time: addMinutes(block.time, offset),
title: "Commercial Break"
}));
return [block, ...injected];
});
}

function getCurrentMetadata() {
const now = new Date();
now.setHours(now.getHours() - 4); // EDT offset
const time = now.toTimeString().slice(0, 5);
const schedule = getScheduleForToday();

for (let i = 0; i < schedule.length; i++) {
const current = schedule[i];
const next = schedule[i + 1];
if (time >= current.time && (!next || time < next.time)) {
const title = current.title;
return {
title,
artist: fallback.artist,
comment: fallback.comment,
genre: fallback.genre,
artwork: artworkMap[title] || fallback.artwork
};
}
}

return fallback;
}

function updateIcecastMetadata(meta) {
const auth = Buffer.from(`${ICECAST_USER}:${ICECAST_PASS}`).toString("base64");

mounts.forEach(({ path }) => {
const query = `/admin/metadata?mount=${path}&mode=updinfo&song=${encodeURIComponent(meta.title)}`;
const options = {
hostname: ICECAST_HOST,
port: ICECAST_PORT,
path: query,
method: "GET",
headers: { Authorization: `Basic ${auth}` }
};

const req = http.request(options, res => {
if (res.statusCode === 200) {
console.log(`✅ Metadata updated: ${meta.title} → ${path}`);
} else {
console.warn(`⚠️ Metadata rejected: ${meta.title} → ${path} | Status: ${res.statusCode}`);
}
});

req.on("error", error => {
console.error(`❌ Metadata update failed for ${path}:`, error.message);
});

req.end();
});
}

// === Start FFmpeg stream ===
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const initialMeta = getCurrentMetadata();

const ffmpeg = spawn(ffmpegPath, [
"-re",
"-probesize", "32M",
"-analyzeduration", "10M",
"-i", streamUrl,
"-map", "0:1",
"-af", "volume=3.0",
"-acodec", "libmp3lame",
"-ar", "44100",
"-b:a", "192k",
"-f", "tee",
"-content_type", "audio/mpeg",
"-metadata", `title=${initialMeta.title}`,
"-metadata", `artist=${initialMeta.artist}`,
"-metadata", `comment=${initialMeta.comment}`,
"-metadata", `genre=${initialMeta.genre}`,
`[f=icecast]icecast://${ICECAST_USER}:${ICECAST_PASS}@${ICECAST_HOST}:${ICECAST_PORT}${mounts[0].path}|icecast://${ICECAST_USER}:${ICECAST_PASS}@${ICECAST_HOST}:${ICECAST_PORT}${mounts[1].path}`
]);

ffmpeg.stderr.on("data", data => {
console.log("FFmpeg:", data.toString());
});

ffmpeg.on("error", err => {
console.error("❌ FFmpeg spawn error:", err.message);
});

ffmpeg.on("exit", (code, signal) => {
console.log(`❌ FFmpeg exited: ${code} | ${signal}`);
});

// === Metadata updater ===
setInterval(() => {
const meta = getCurrentMetadata();
updateIcecastMetadata(meta);
fs.writeFileSync("currentMetadata.json", JSON.stringify({
...meta,
timestamp: new Date().toISOString()
}, null, 2));
}, 1000);

// === Express API ===
const app = express();
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || "0.0.0.0";

// ✅ Proxy Icecast stream through backend
app.get("/stream", (req, res) => {
const icecastUrl = `http://localhost:${ICECAST_PORT}${mounts[0].path}`;
req.pipe(request(icecastUrl)).on("error", err => {
console.error("❌ Stream proxy error:", err.message);
res.status(500).send("Stream unavailable");
}).pipe(res);
});

app.get("/metadata", (req, res) => {
res.json(getCurrentMetadata());
});

app.get("/health", (req, res) => {
res.json({
mounts: mounts.map(m => m.path),
metadata: getCurrentMetadata(),
timestamp: new Date().toISOString()
});
});

app.get("/icecast-health", (req, res) => {
http.get(`http://${ICECAST_HOST}:${ICECAST_PORT}`, response =>