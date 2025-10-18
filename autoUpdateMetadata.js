const fs = require("fs");
const axios = require("axios");

// Load schedule and artwork
const schedule = require("./schedule.json").schedule;
const artworkMap = require("./artwork.json");

// Station metadata
const station = {
artist: "WKMG-DT1",
comment: "ClickOrlando / News 6",
genre: "Television"
};

// Fallback block
const fallback = {
title: "We're Be Right Back!",
artwork: artworkMap["We're Be Right Back!"]
};

// Commercial break logic
const commercialBreakMinutes = [7, 14, 21, 28, 36, 44];
const commercialArtwork = artworkMap["Commercial Break"];

// Get current time
const now = new Date();
const day = now.toLocaleDateString("en-US", { weekday: "long" });
const currentTime = now.toTimeString().slice(0, 5);
const currentMinute = now.getMinutes();

// Resolve today's schedule
let todaySchedule = schedule[day];
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = schedule[refDay];
}

// Find current block
let currentBlock = null;
for (let i = 0; i < todaySchedule.length; i++) {
const block = todaySchedule[i];
const nextBlock = todaySchedule[i + 1];
if (
currentTime >= block.time &&
(!nextBlock || currentTime < nextBlock.time)
) {
currentBlock = block;
break;
}
}

// Determine metadata
let metadata = {
title: fallback.title,
artist: station.artist,
comment: station.comment,
genre: station.genre,
artwork: fallback.artwork
};

if (currentBlock) {
const isCommercial = commercialBreakMinutes.includes(currentMinute);
metadata.title = isCommercial ? "Commercial Break" : currentBlock.title;
metadata.artwork = isCommercial
? commercialArtwork
: currentBlock.artwork || artworkMap[currentBlock.title] || fallback.artwork;
}

// Send to Icecast (example using axios)
axios
.get("http://localhost:8080/admin/metadata", {
params: {
mount: "/stream",
mode: "updinfo",
song: metadata.title
},
auth: {
username: "source",
password: "Jjbutter12"
}
})
.then(() => console.log("Metadata updated:", metadata.title))
.catch((err) => console.error("Metadata update failed:", err.message));