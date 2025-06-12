// ✅ eleven.js – Röstgenerering med optimerad svensk röst
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.ELEVEN_API_KEY;
const voiceId = process.env.ELEVEN_VOICE_ID;

async function synthesize(text, filename = "output.mp3") {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(
    url,
    {
      text,
      model_id: "eleven_multilingual_v2", // 🔥 Bättre svensk modell
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.9
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      responseType: "stream",
    }
  );

  const filePath = path.join(__dirname, "public", "audio", filename);
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return `/audio/${filename}`;
}

module.exports = { synthesize };
