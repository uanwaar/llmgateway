const fs = require('fs');
const path = require('path');
const WaveFile = require('wavefile');

// Input and output directories
const inputDir = path.join(__dirname, '..', 'tests', 'audio-files');
const outputDir = path.join(__dirname, '..', 'tests', 'audio-files', '24KHz');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all WAV files from input directory
const files = fs.readdirSync(inputDir).filter(file => 
    file.endsWith('.wav') && !fs.statSync(path.join(inputDir, file)).isDirectory()
);

console.log(`Found ${files.length} audio files to convert:`);
files.forEach(file => console.log(`  - ${file}`));

// Convert each file
files.forEach(filename => {
    try {
        const inputPath = path.join(inputDir, filename);
        const outputPath = path.join(outputDir, filename);
        
        console.log(`\nConverting ${filename}...`);
        
        // Read the original WAV file
        const wav = new WaveFile.WaveFile();
        const buffer = fs.readFileSync(inputPath);
        wav.fromBuffer(buffer);
        
        console.log(`  Original sample rate: ${wav.fmt.sampleRate}Hz`);
        
        // Convert to 24KHz
        wav.toSampleRate(24000);
        
        console.log(`  New sample rate: ${wav.fmt.sampleRate}Hz`);
        
        // Write the converted file
        fs.writeFileSync(outputPath, wav.toBuffer());
        
        console.log(`  ✓ Saved to ${outputPath}`);
        
    } catch (error) {
        console.error(`  ✗ Error converting ${filename}:`, error.message);
    }
});

console.log('\nConversion complete!');