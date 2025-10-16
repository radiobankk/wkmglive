const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const scheduleData = require('./schedule.json');

// Path to output metadata
const metadataPath = path.join(__dirname, 'metadata.json');

// Default metadata if no program matches
const defaultMetadata = {
title: "We're Be Right Back!",
artist: "WKMG-DT1",
comment: "Live MP3 Relay / 192K",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&"
};

// Resolve "same as Monday"
const schedule = scheduleData.schedule;
['Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
if (schedule[day] === 'same as Monday') {
schedule[day] = schedule['Monday'];
}
});

// Function to get current program
function getCurrentProgram() {
const now = moment().tz('America/New_York');
const currentDay = now.format('dddd');
const currentTime = now.format('HH:mm');

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];
let currentProgram = defaultMetadata;

for (let i = 0; i < todaySchedule.length; i++) {
const show = todaySchedule[i];
const nextShow = todaySchedule[i + 1];

if (currentTime >= show.time && (!nextShow || currentTime < nextShow.time)) {
currentProgram = {
title: show.title,
artist: "WKMG-DT1",
comment: `Now Playing: ${show.title} / WKMG-DT1`,
artwork: show.artwork || defaultMetadata.artwork,
timestamp: now.format('YYYY-MM-DD HH:mm:ss')
};
break;
}
}

return currentProgram;
}

// Update metadata every 1 second
setInterval(() => {
const meta = getCurrentProgram();
try {
fs.writeFileSync(metadataPath, JSON.stringify(meta, null, 2));
console.log(`[${meta.timestamp}] Metadata updated: ${meta.title}`);
} catch (err) {
console.error("Failed to write metadata:", err);
}
}, 1000);

// Write initial metadata immediately
fs.writeFileSync(metadataPath, JSON.stringify(getCurrentProgram(), null, 2));
console.log("🟢 autoUpdateMetadata.js running — updating every 1 second");