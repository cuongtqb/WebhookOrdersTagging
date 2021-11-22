const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema({
    totalPrice: {
        type: Number,
    },
    tag: {
        type: String,
    }
});


module.exports = mongoose.model("Setting", SettingSchema);