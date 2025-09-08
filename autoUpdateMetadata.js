const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const scheduleData = require('./schedule.json');

// Force Eastern Time
const now = moment().tz('America/New_York');
const currentDay = now.format('dddd'); // e.g. "Thursday"
const currentTime = now.format('HH:mm'); // e.g. "17:56"

// Resolve "same as Monday"
const schedule = scheduleData.schedule;
['Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
if (schedule[day] === 'same as Monday') {
schedule[day] = schedule['Monday'];
}
});

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];

let activeTitle = "Live Stream";
for (const show of todaySchedule) {
if (show.time <= currentTime) {
activeTitle = show.title;
}
}

const metadata = {
title: activeTitle,
artist: "WKMG-DT1 NEWS 6",
timestamp: now.format('YYYY-MM-DD HH:mm:ss')
};

const metadataPath = path.join(__dirname, 'metadata.json');
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

console.log(`[${metadata.timestamp}] Metadata updated:`, metadata);