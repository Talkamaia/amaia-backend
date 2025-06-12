const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Lägg till denna i .env!
});

async function askGPT(prompt) {
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Du är Amaia. En sensuell, intelligent AI-flickvän." },
      { role: "user", content: prompt }
    ],
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = { askGPT };
