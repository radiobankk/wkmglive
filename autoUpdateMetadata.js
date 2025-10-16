const fs = require('fs');
const path = require('path');

// Load schedule and artwork
const scheduleData = require('./schedule.json');
const artworkArray = require('./artwork.json').artwork;

// Convert "HH:MM" to total minutes
function toMinutes(t) {
const [h, m] = t.split(':').map(Number);
return h * 60 + m;
}

// Get current program based on time
function getCurrentProgram(schedule, time) {
const nowMinutes = toMinutes(time);
const sorted = schedule
.map(entry => ({ ...entry, minutes: toMinutes(entry.time) }))
.sort((a, b) => a.minutes - b.minutes);

let current = sorted[0];
for (const entry of sorted) {
if (entry.minutes <= nowMinutes) current = entry;
else break;
}
return current;
}

// Find artwork URL by title
function getArtworkUrl(title) {
const match = artworkArray.find(item => item.title === title);
return match ? match.url : null;
}

// Inject metadata to backend (replace with your logic)
function injectMetadata(title, artworkUrl) {
console.log(`[${new Date().toISOString()}] Injecting: ${title}`);
console.log(`Artwork: ${artworkUrl || 'None'}`);
// Example: send to backend
// fetch('http://your-backend/metadata', {
// method: 'POST',
// headers: { 'Content-Type': 'application/json' },
// body: JSON.stringify({ title, artwork: artworkUrl })
// });
}

// Write metadata to JSON file
function writeMetadataFile(metadata) {
const outputPath = path.join(__dirname, 'currentMetadata.json');
fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
}

// Main loop
function updateMetadata() {
const now = new Date();
const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

let todaySchedule = scheduleData.schedule[currentDay];
if (typeof todaySchedule === 'string' && todaySchedule.includes('same as')) {
const refDay = todaySchedule.split('same as ')[1];
todaySchedule = scheduleData.schedule[refDay];
}

if (Array.isArray(todaySchedule) && todaySchedule.length > 0) {
const currentProgram = getCurrentProgram(todaySchedule, currentTime);
const artworkUrl = getArtworkUrl(currentProgram.title);

injectMetadata(currentProgram.title, artworkUrl);
writeMetadataFile({
time: currentTime,
title: currentProgram.title,
artwork: artworkUrl,
day: currentDay,
timestamp: now.toISOString()
});
} else {
console.log(`No schedule found for ${currentDay}`);
}
}

// Refresh every second
setInterval(updateMetadata, 1000);
