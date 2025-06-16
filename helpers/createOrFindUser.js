const User = require("../models/User");

async function createOrFindUser(phone) {
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({ phone });
  }
  return user;
}

module.exports = { createOrFindUser };
