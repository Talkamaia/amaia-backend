import { speak } from './eleven.js';

const run = async () => {
  const filepath = await speak("Hej älskling, jag saknade dig...");
  console.log("🔊 Ljudfil genererad:", filepath);
};

run();
