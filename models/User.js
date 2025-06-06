const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  voiceSeconds: { type: Number, default: 120 },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
