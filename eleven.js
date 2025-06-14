const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const VOICE_ID = process.env.VOICE_ID;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;

async function synthesize(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const headers = {
    "xi-api-key": ELEVEN_API_KEY,
    "Content-Type": "application/json",
  };

  const data = {
    text,
    voice_settings: {
      stability: 0.4,
      similarity_boost: 0.7,
    },
  };

  const response = await axios.post(url, data, { responseType: "arraybuffer", headers });

  const filename = `${Date.now()}.mp3`;
  const filePath = path.join(__dirname, "audio", filename);

  fs.writeFileSync(filePath, response.data);
  return filePath;
}

module.exports = synthesize;
