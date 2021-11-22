const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
    id: String,
    shop: String,
    state: String,
    isOnline: Boolean,
    accessToken: String,
    scope: String,
});


module.exports = mongoose.model("SessionSchema", SessionSchema);