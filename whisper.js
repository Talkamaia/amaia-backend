import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribe(buffer) {
  const filePath = "/tmp/input.wav";
  fs.writeFileSync(filePath, buffer);

  const transcript = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    language: "sv"
  });

  return transcript.text;
}
