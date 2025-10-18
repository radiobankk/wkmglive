const express = require("express");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

// === Config ===
const ICECAST_HOST = process.env.ICECAST_HOST || "wkmglive.onrender.com";
const ICECAST_PORT = process.env.ICECAST_PORT || 10000;
const ICECAST_USER = "wherejah";
const ICECAST_PASS = "Jjbutter12";

// === Load schedule and artwork ===
const scheduleData = JSON.parse(fs.readFileSync("schedule.json", "utf8"));
const artworkMap = fs.existsSync("artwork.json") ? require("./artwork.json") : {};
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
if (current.title === "Commercial Break") {
return {
title: "Commercial Break",
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
genre: "Television",
artwork: artworkMap["Commercial Break"] || fallback.artwork
};
}

return {
title: current.title,
artist: fallback.artist,
comment: fallback.comment,
genre: fallback.genre,
artwork: artworkMap[current.title] || fallback.artwork
};
}
}

return fallback;
}

function updateIcecastMetadata(meta) {
const auth = Buffer.from(`${ICECAST_USER}:${ICECAST_PASS}`).toString("base64");
const mounts = ["/wkmglive.mp3", "/stream-wkmg.mp3"];

mounts.forEach(mount => {
const query = `/admin/metadata?mount=${mount}&mode=updinfo&song=${encodeURIComponent(meta.title)}`;
const options = {
hostname: ICECAST_HOST,
port: ICECAST_PORT,
path: query,
method: "GET",
headers: { Authorization: `Basic ${auth}` }
};

const req = http.request(options, res => {
console.log(`🔁 Metadata updated: ${meta.title} → ${mount} | Status: ${res.statusCode}`);
});

req.on("error", error => {
console.error(`❌ Metadata update failed for ${mount}:`, error.message);
});

req.end();
});
}

// === Start FFmpeg stream to both mounts ===
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";
const initialMeta = getCurrentMetadata();

const ffmpeg = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn",
"-af", "volume=3.0",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "tee",
"-content_type", "audio/mpeg",
"-metadata", `title=${initialMeta.title}`,
"-metadata", `artist=${initialMeta.artist}`,
"-metadata", `comment=${initialMeta.comment}`,
"-metadata", `genre=${initialMeta.genre}`,
`[icecast://${ICECAST_USER}:${ICECAST_PASS}@${ICECAST_HOST}:${ICECAST_PORT}/wkmglive.mp3|icecast://${ICECAST_USER}:${ICECAST_PASS}@${ICECAST_HOST}:${ICECAST_PORT}/stream-wkmg.mp3]`
]);

ffmpeg.stderr.on("data", data => {
console.log("FFmpeg:", data.toString());
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
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.get("/metadata", (req, res) => {
res.json(getCurrentMetadata());
});

app.listen(PORT, HOST, () => {
console.log(`📡 Metadata API running at http://${HOST}:${PORT}`);
});