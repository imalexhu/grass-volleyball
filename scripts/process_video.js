import fs from 'fs';
import path from 'path';

// Read the parsed events
const eventsPath = path.join(process.cwd(), 'scripts', 'match_events.json');
let events;
try {
    events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
} catch (err) {
    console.error("Failed to read match_events.json. Make sure it exists in the scripts directory.");
    process.exit(1);
}

const firstServe = events.find(e => e.type === 'serve');
if (!firstServe) {
    console.error("No serve found in events.");
    process.exit(1);
}
const FIRST_SERVE_TIME = firstServe.timestamp;

const rallies = [];
let currentServe = null;

for (const event of events) {
    if (event.type === 'serve') {
        currentServe = event;
    } else if (event.type === 'point' && currentServe) {
        rallies.push({
            serve: currentServe,
            point: event
        });
        currentServe = null; // Wait for next serve
    }
}

let concatList = '';
let filterGraph = '';
let currentFinalTime = 0;

rallies.forEach((rally, index) => {
    // Cut from Serve - 2s to Point + 2s
    let startSec = (rally.serve.timestamp - FIRST_SERVE_TIME) / 1000 - 2;
    if (startSec < 0) startSec = 0; // Don't go before the video starts
    
    let endSec = (rally.point.timestamp - FIRST_SERVE_TIME) / 1000 + 2;
    let duration = endSec - startSec;
    
    concatList += `file 'input.mp4'\n`;
    concatList += `inpoint ${startSec.toFixed(3)}\n`;
    concatList += `outpoint ${endSec.toFixed(3)}\n`;
    
    // Create text overlay for this rally
    // Display score as "ScoreA - ScoreB" in the top center
    const scoreText = `${rally.point.scoreA} - ${rally.point.scoreB}`;
    
    // Enable the text only during this clip in the final stitched video
    const enableStr = `between(t,${currentFinalTime.toFixed(3)},${(currentFinalTime + duration).toFixed(3)})`;
    
    // FFmpeg drawtext parameters
    // We use a semi-transparent black box behind the text to ensure it's readable
    const drawtext = `drawtext=text='${scoreText}':fontsize=72:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=15:x=(w-text_w)/2:y=100:enable='${enableStr}'`;
    
    filterGraph += drawtext;
    if (index < rallies.length - 1) {
        filterGraph += ',';
    }
    
    currentFinalTime += duration;
});

filterGraph = '[0:v]' + filterGraph + '[outv]';

// Output the files for FFmpeg
fs.writeFileSync(path.join(process.cwd(), 'scripts', 'concat_list.txt'), concatList);
fs.writeFileSync(path.join(process.cwd(), 'scripts', 'filter_graph.txt'), filterGraph);

console.log("Successfully processed " + rallies.length + " rallies.");
console.log("Generated scripts/concat_list.txt and scripts/filter_graph.txt");
console.log("\nTo render the final video, place your raw video at 'scripts/input.mp4' and run the following command from the scripts directory:");
console.log("cd scripts && ffmpeg -f concat -safe 0 -i concat_list.txt -filter_complex_script filter_graph.txt -map \"[outv]\" -map 0:a -c:v libx264 -c:a aac output.mp4");
