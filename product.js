const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

name: String,
price: Number,
quantity: Number,

image: String, // NEW FIELD

farmer:{
type: mongoose.Schema.Types.ObjectId,
ref:"User"
}

});

module.exports = mongoose.model("Product", productSchema);