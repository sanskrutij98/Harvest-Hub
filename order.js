const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        status:{
            type:String,
            default:"Pending"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);