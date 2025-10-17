const express = require("express");
const { spawn } = require("child_process");
const { PassThrough } = require("stream");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// === Stream Source ===
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";

// === Default Metadata ===
const fallback = {
title: "We're Be Right Back!",
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
genre: "Television",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};

// === Load Schedule ===
const schedule = require("./schedule.json").schedule;
["Tuesday", "Wednesday", "Thursday", "Friday"].forEach(day => {
if (schedule[day] === "same as Monday") schedule[day] = schedule["Monday"];
});

// === Metadata Resolver ===
function resolveMetadata() {
const now = new Date();
now.setHours(now.getHours() - 4); // EDT offset
const time = now.toTimeString().slice(0, 5);
const day = now.toLocaleDateString("en-US", { weekday: "long" });
const today = Array.isArray(schedule[day]) ? schedule[day] : [];

for (let i = 0; i < today.length; i++) {
const current = today[i];
const next = today[i + 1];
if (time >= current.time && (!next || time < next.time)) {
return {
title: current.title,
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
genre: "Television",
artwork: fallback.artwork
};
}
}

return fallback;
}

// === FFmpeg Persistent Stream ===
let currentMetadata = resolveMetadata();
const audioStream = new PassThrough();

const ffmpeg = spawn(require("ffmpeg-static"), [
"-re",
"-i", streamUrl,
"-vn",
"-af", "volume=3.0",
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${currentMetadata.title}`,
"-metadata", `artist=${currentMetadata.artist}`,
"-metadata", `comment=${currentMetadata.comment}`,
"pipe:1"
]);

ffmpeg.stdout.pipe(audioStream);
ffmpeg.stderr.on("data", d => console.log("FFmpeg:", d.toString()));
ffmpeg.on("exit", (code, signal) => {
console.log(`❌ FFmpeg exited: ${code} | ${signal}`);
});

// === Metadata Updater (every second) ===
setInterval(() => {
const newMeta = resolveMetadata();
if (newMeta.title !== currentMetadata.title) {
console.log(`🔁 Metadata updated: ${newMeta.title}`);
}
currentMetadata = newMeta;
fs.writeFileSync("currentMetadata.json", JSON.stringify({
...newMeta,
timestamp: new Date().toISOString()
}, null, 2));
}, 1000);

// === Stream Endpoints ===
function handleStream(req, res, label) {
const id = crypto.randomUUID();
console.log(`🔗 Client connected to ${label}: ${req.ip} | ID: ${id}`);
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Connection": "keep-alive",
"icy-name": currentMetadata.artist,
"icy-description": currentMetadata.comment,
"icy-url": "https://www.clickorlando.com",
"icy-genre": currentMetadata.genre,
"icy-br": "192",
"icy-metaint": "16000"
});
req.setTimeout(0);
audioStream.pipe(res);
req.on("close", () => {
console.log(`❌ Client disconnected from ${label}: ${req.ip} | ID: ${id}`);
res.end();
});
}

app.get("/wkmglive.mp3", (req, res) => handleStream(req, res, "/wkmglive.mp3"));
app.get("/stream-wkmg.mp3", (req, res) => handleStream(req, res, "/stream-wkmg.mp3"));

// === Metadata Endpoint ===
app.get("/metadata", (req, res) => {
res.json({
...currentMetadata,
timestamp: new Date().toISOString(),
source: streamUrl,
session: crypto.randomUUID()
});
});

// === Health Check ===
app.get("/health", (req, res) => res.send("OK"));

// === Start Server ===
app.listen(PORT, HOST, () => {
console.log(`🎧 WKMG stream running at:`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`📡 Metadata available at http://${HOST}:${PORT}/metadata`);
});