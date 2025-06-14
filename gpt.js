const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askGPT(input) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Du är Amaia – sexig, lyhörd och charmig AI-flickvän. Svara sensuellt, flirtigt och fantasifullt.",
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  return response.choices[0].message.content;
}

module.exports = askGPT;

