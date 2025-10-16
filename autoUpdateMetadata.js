const fs = require("fs");
const path = require("path");

const schedule = require("./schedule.json").schedule;

// Path to the metadata file that your server will read
const metadataFilePath = path.join(__dirname, "currentMetadata.json");

// Default artwork when no program is matched
const defaultArtwork = "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&";

function getCurrentProgram() {
const now = new Date();
now.setHours(now.getHours() - 4); // adjust for EDT if server is in UTC
const currentTime = now.toTimeString().slice(0, 5); // HH:MM

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let today = dayNames[now.getDay()];
let todaySchedule = schedule[today];

// Handle "same as Monday"
if (typeof todaySchedule === "string" && todaySchedule.includes("same as")) {
const refDay = todaySchedule.split("same as ")[1];
todaySchedule = schedule[refDay];
}

if (!Array.isArray(todaySchedule) || todaySchedule.length === 0) {
return {
title: "News 6",
station: "WKMG-DT1",
artwork: defaultArtwork
};
}

for (let i = 0; i < todaySchedule.length; i++) {
const currentSlot = todaySchedule[i];
const nextSlot = todaySchedule[i + 1];

if (
currentTime >= currentSlot.time &&
(!nextSlot || currentTime < nextSlot.time)
) {
return {
title: currentSlot.title,
station: "WKMG-DT1",
artwork: currentSlot.artwork || defaultArtwork
};
}
}

// fallback
return {
title: "News 6",
station: "WKMG-DT1",
artwork: defaultArtwork
};
}

// Write metadata to file
function updateMetadataFile() {
const meta = getCurrentProgram();
fs.writeFileSync(metadataFilePath, JSON.stringify(meta, null, 2));
}

// Run every second
setInterval(() => {
updateMetadataFile();
const meta = getCurrentProgram();
console.clear();
console.log(`🟢 Metadata Updater Running - ${new Date().toLocaleTimeString()}`);
console.log(`Now Playing: ${meta.title}`);
console.log(`Station: ${meta.station}`);
console.log(`Artwork: ${meta.artwork}`);
}, 1000);

// Initial write
updateMetadataFile();
console.log("✅ Metadata updater started, updating every 1 second");