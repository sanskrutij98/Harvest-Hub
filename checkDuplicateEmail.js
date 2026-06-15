// middleware/checkDuplicateEmail.js

const User = require("../models/User"); // adjust path if needed

const checkDuplicateEmail = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json("Email is required ❌");
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json("Email already registered ❌");
        }

        next(); // email is unique, continue to route
    } catch (error) {
        console.log(error);
        res.status(500).json("Server error");
    }
};

module.exports = checkDuplicateEmail;
