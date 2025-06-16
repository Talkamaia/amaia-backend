const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

function convertMulawToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputFormat("mulaw")
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}

module.exports = { convertMulawToWav };
