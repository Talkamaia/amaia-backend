const axios = require("axios");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.ELEVEN_API_KEY;
const voiceId = process.env.ELEVEN_VOICE_ID;

async function synthesize(text, filename = "output.mp3") {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(url,
    {
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
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
