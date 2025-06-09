const {
  basePersona,
  silentLead,
  activeListening,
  arousalBuild,
  boundaryViolation,
} = require("./prompts/amaia");

const TABU = [
  /barn/i, /minderårig/i, /under\s*18/i,
  /våldtäkt/i, /rape/i, /tvingad/i,
  /zoofili/i, /bestiality/i,
];

function violatesPolicy(text) {
  return TABU.some((re) => re.test(text));
}

function buildSystemPrompt(ctx) {
  if (violatesPolicy(ctx.userInput)) {
    return `${basePersona}\n${boundaryViolation}`;
  }
  if (ctx.silenceMs >= 10000) {
    return `${basePersona}\n${silentLead}`;
  }
  if (ctx.aroused) {
    return `${basePersona}\n${arousalBuild}`;
  }
  if (ctx.userInput.split(" ").length > 12) {
    return `${basePersona}\n${activeListening}`;
  }
  return basePersona;
}

module.exports = { buildSystemPrompt };
