const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const scheduleData = require('./schedule.json');

function updateMetadata() {
const now = moment().tz('America/New_York');
const currentDay = now.format('dddd');
const currentTime = now.format('HH:mm');

const schedule = scheduleData.schedule;
// Resolve "same as Monday"
['Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
if (schedule[day] === 'same as Monday') {
schedule[day] = schedule['Monday'];
}
});

const todaySchedule = Array.isArray(schedule[currentDay]) ? schedule[currentDay] : [];
let activeShow = "WKMG-DT1 Live Stream";

// Find currently active program by comparing time slots
for (let i = 0; i < todaySchedule.length; i++) {
const show = todaySchedule[i];
const nextShow = todaySchedule[i + 1];
if (currentTime >= show.time && (!nextShow || currentTime < nextShow.time)) {
activeShow = show.title;
break;
}
}

const metadata = {
title: activeShow,
artist: "WKMG-DT1",
comment: "ClickOrlando / WKMG-DT1",
artwork: "https://cdn.discordapp.com/attachments/1428212641083424861/1428217755752202260/IMG_9234.png?ex=68f25baf&is=68f10a2f&hm=373514a772bf78ebfcd1b4c6316a637a5eeac0005cf050907a151cdfadebf689&",
timestamp: now.format('YYYY-MM-DD HH:mm:ss')
};

fs.writeFileSync(
path.join(__dirname, 'currentMetadata.json'),
JSON.stringify(metadata, null, 2)
);

console.log(`[${metadata.timestamp}] Active Title → ${metadata.title}`);
}

setInterval(updateMetadata, 1000);
updateMetadata();