require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const { speak } = require('./eleven');
ffmpeg.setFfmpegPath(ffmpegPath);

// Text att säga
const text = "Hej älskling. Om du hör det här fungerar systemet.";
const mp3Path = path.join(__dirname, 'public/audio/test.mp3');
const rawPath = path.join(__dirname, 'public/audio/test.raw');

async function generateTestAudio() {
  try {
    console.log('🎙️ Genererar test.mp3 via ElevenLabs...');
    await speak(text, mp3Path);

    await new Promise((resolve, reject) => {
      ffmpeg(mp3Path)
        .audioFrequency(8000)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .format('s16le')
        .on('end', () => {
          console.log('✅ test.raw skapad – redo att spelas upp via Twilio');
          resolve();
        })
        .on('error', reject)
        .save(rawPath);
    });
  } catch (err) {
    console.error('❌ Fel under testgenerering:', err);
  }
}

generateTestAudio();
