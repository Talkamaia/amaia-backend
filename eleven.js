require("dotenv").config();
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");
const { v4: uuid } = require("uuid");

const apiKey  = process.env.ELEVEN_API_KEY;
const voiceId = process.env.ELEVEN_VOICE_ID;

async function synth(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const { data } = await axios.post(
    url,
    {
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.45, similarity_boost: 0.8 }
    },
    {
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      responseType: "arraybuffer"
    }
  );

  const dir = path.join(__dirname, "public/audio");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${uuid()}.mp3`;
  fs.writeFileSync(path.join(dir, filename), data);
  return filename;                // bara filnamnet
}

module.exports = synth;
