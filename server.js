const express = require("express");
const fs = require("fs");
const { PassThrough } = require("stream");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
app.use(cors());

// The live source stream
const streamUrl = "http://208.89.99.124:5004/auto/v6.1";

// Stream pipeline
let audioStream = new PassThrough();
let ffmpegProcess;

// Read initial metadata
let currentMetadata = {
title: "News 6",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};

// Start FFmpeg with initial metadata
function startFFmpeg(meta) {
if (ffmpegProcess) ffmpegProcess.kill("SIGKILL");

ffmpegProcess = spawn(ffmpegPath, [
"-re",
"-i", streamUrl,
"-vn", // ignore video
"-acodec", "libmp3lame",
"-b:a", "192k",
"-f", "mp3",
"-metadata", `title=${meta.title}`,
"-metadata", `comment=${meta.comment}`,
"-metadata", `artwork=${meta.artwork}`,
"pipe:1"
]);

ffmpegProcess.stdout.pipe(audioStream, { end: false });

ffmpegProcess.stderr.on("data", data => console.log(data.toString()));
ffmpegProcess.on("exit", (code, signal) => console.log(`FFmpeg exited: ${code} | ${signal}`));
}

startFFmpeg(currentMetadata);

// Endpoint for streaming: /stream-wkmg.mp3
app.get("/stream-wkmg.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});
audioStream.pipe(res);
req.on("close", () => res.end());
});

// Alias streaming endpoint: /wkmglive.mp3
app.get("/wkmglive.mp3", (req, res) => {
res.writeHead(200, {
"Content-Type": "audio/mpeg",
"Transfer-Encoding": "chunked",
"Connection": "keep-alive"
});
audioStream.pipe(res);
req.on("close", () => res.end());
});

// Metadata endpoint
app.get("/metadata", (req, res) => {
res.json(currentMetadata);
});

// Function to update metadata from your JSON
function updateMetadata() {
try {
const meta = JSON.parse(fs.readFileSync("./currentMetadata.json"));
// Only restart FFmpeg if metadata changed
if (
meta.title !== currentMetadata.title ||
meta.comment !== currentMetadata.comment ||
meta.artwork !== currentMetadata.artwork
) {
console.log(`Updating metadata: ${meta.title}`);
currentMetadata = meta;
startFFmpeg(currentMetadata);
}
} catch (err) {
console.error("Failed to read metadata:", err);
}
}

// Watch metadata every 1 second
setInterval(updateMetadata, 1000);

app.listen(PORT, HOST, () => {
console.log(`WKMG MP3 stream running at:`);
console.log(`➡️ http://${HOST}:${PORT}/stream-wkmg.mp3`);
console.log(`➡️ http://${HOST}:${PORT}/wkmglive.mp3`);
console.log(`Metadata updates every 1 second from currentMetadata.json`);
});