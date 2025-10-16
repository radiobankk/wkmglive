const fs = require("fs");
const path = require("path");
const schedule = require("./schedule.json").schedule;

const metadataFile = path.join(__dirname, "currentMetadata.json");
const stationName = "WKMG-DT1 NEWS 6";
const defaultArtwork = "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&";

// Function to get current program based on schedule
function getCurrentProgram() {
const now = new Date();
now.setHours(now.getHours() - 4); // Adjust for EDT if server in UTC
const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = dayNames[now.getDay()];
let todaySchedule = schedule[today];

// Handle "same as Monday"
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = schedule[refDay];
}

if (!Array.isArray(todaySchedule)) {
return {
title: stationName,
artwork: defaultArtwork
};
}

for (let i = 0; i < todaySchedule.length; i++) {
const currentSlot = todaySchedule[i];
const nextSlot = todaySchedule[i + 1];

if (currentTime >= currentSlot.time && (!nextSlot || currentTime < nextSlot.time)) {
return {
title: currentSlot.title,
artwork: currentSlot.artwork || defaultArtwork
};
}
}

return {
title: stationName,
artwork: defaultArtwork
};
}

// Function to write metadata JSON
function updateMetadataFile() {
const currentProgram = getCurrentProgram();

const metadata = {
title: currentProgram.title,
album: stationName, // Show station at bottom
artwork: currentProgram.artwork,
timestamp: new Date().toISOString()
};

fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2), (err) => {
if (err) console.error("Error writing metadata:", err);
});
}

// Update every 1 second
setInterval(updateMetadataFile, 1000);

// Initial write
updateMetadataFile();

console.log("✅ Metadata updater running, updating every 1 second.");