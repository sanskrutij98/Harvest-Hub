require("dotenv").config();
console.log("JWT_SECRET from env:", process.env.JWT_SECRET);
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Product = require("./models/product");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const checkDuplicateEmail = require("./middleware/checkDuplicateEmail");
const Order = require("./models/order");
const path = require("path");
const app = express();
const multer = require("multer");
const Notification = require("./models/notification");

const storage = multer.diskStorage({
destination: function(req,file,cb){
cb(null, path.join(__dirname, "uploads"));
},
filename: function(req,file,cb){
cb(null,Date.now()+"-"+file.originalname);
}
});

const upload = multer({storage});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static("uploads"));
app.use("/images", express.static(path.join(__dirname, "../images")));

// ✅ MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
    console.log("MongoDB Connected ✅");

    // ✅ Check if admin exists
    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
        const hashedPassword = await bcrypt.hash("Admin@123", 10);

        const admin = new User({
            name: "Admin",
            email: "admin@harvesthub.com",
            password: hashedPassword,
            role: "admin"
        });

        await admin.save();
        console.log("✅ Default admin created");
    } else {
        console.log("ℹ️ Admin already exists");
    }
})
    .catch(err => console.log(err));

app.listen(5000, () => {
    console.log("Server running on port 5000");
});

app.get("/", (req, res) => {
    res.send("Harvest Hub Backend Running 🌾");
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if(role === "admin"){
        return res.status(403).json("Admin registration not allowed");
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json("Email already registered ❌");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await newUser.save();

        // ✅ Notification for admin
        const admin = await User.findOne({ role: "admin" });

        if (admin) {
            const notification = new Notification({
                user: admin._id,
                message: `New user registered: ${email}`
            });

            await notification.save();
        }

        res.status(201).json({ message: "User Registered Successfully ✅" });

    } catch (error) {
        console.log(error);
        res.status(500).json("Error registering user");
    }
});

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 JWT Verification Middleware (Bearer Format)
const authMiddleware = (req, res, next) => {   
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(403).json("Access Denied ❌ No token provided");
    }

    // Format: Bearer TOKEN
    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(403).json("Invalid Token Format ❌");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json("Invalid Token ❌");
    }
};

// Login API with JWT
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json("User not found");
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json("Invalid password");
        }

        user.isOnline = true;
        await user.save();

        const token = jwt.sign(
        { id: user._id, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
        );

res.json({ token });

    } catch (error) {
        console.error(error);
        res.status(500).json("Server error");
    }
});

// ➕ Add Product
app.post("/add-product", authMiddleware, upload.single("image"), async (req,res)=>{
    
const {name,price,quantity}=req.body;
const newProduct=new Product({

name,
price,
quantity,
image: req.file ? req.file.filename : "",
farmer:req.user.id
});

await newProduct.save();

res.json({message:"Product added successfully"});
});

// 📦 Get All Products
app.get("/products", authMiddleware, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 100;
    const skip = (page - 1) * limit;

    if (req.user.role === "farmer") {
    const products = await Product.find({ farmer: req.user.id })
        .populate("farmer", "name");
    return res.json(products);
    }

    const products = await Product.find()
        .populate("farmer", "name"); 
    res.json(products);
});

app.put("/update-product/:id", authMiddleware, async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        return res.status(404).json({ message: "Product not found" });
    }

    if (product.farmer.toString() !== req.user.id) {
        return res.status(403).json({ message: "Not allowed" });
    }

    const { name, price, quantity } = req.body;

    product.name = name;
    product.price = price;
    product.quantity = quantity;

    await product.save();

    res.json({ message: "Product updated successfully" });
});

app.get("/dashboard", authMiddleware, (req, res) => {
    res.json({
        message: "Welcome to Dashboard 🎉",
        user: req.user
    });
});

app.post("/buy-product/:id", authMiddleware, async (req, res) => {
    const { quantity } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product || product.quantity < quantity) {
        return res.status(400).json({ message: "Not enough stock" });
    }

    // reduce stock
    product.quantity -= quantity;
    await product.save();

    // create order
    const order = new Order({
        product: product._id,
        customer: req.user.id,
        quantity
    });
    await order.save();

    // 🔔 CREATE NOTIFICATION FIRST
    const notification = new Notification({
        user: product.farmer,
        message: `Your product ${product.name} was purchased`
    });
    await notification.save();

    // ✅ DEBUG
    console.log("Notification created for:", product.farmer);

    // ✅ THEN SEND RESPONSE
    res.json({ message: "Order placed successfully" });
});

app.post("/logout", authMiddleware, async (req,res)=>{
const user = await User.findById(req.user.id);

if(user){
user.isOnline = false;
await user.save();
}

res.json({message:"Logged out successfully"});
});

// 📜 Get Order History
app.get("/orders", authMiddleware, async (req, res) => {
    try {
        let orders;

        if (req.user.role === "customer") {
            // Customer sees their orders
            orders = await Order.find({ customer: req.user.id })
                .populate("product");
        } else if (req.user.role === "farmer") {
            // Farmer sees orders of their products
            orders = await Order.find()
                .populate({
                    path: "product",
                    match: { farmer: req.user.id }
                })
                .populate("customer");
            
            orders = orders.filter(order => order.product !== null);
        } else {
            orders = await Order.find()
                .populate("product")
                .populate("customer");
        }

        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching orders" });
    }
});

function isAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

app.get("/admin/stats", authMiddleware, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalFarmers = await User.countDocuments({ role: "farmer" });
        const totalCustomers = await User.countDocuments({ role: "customer" });
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();

        // Calculate total revenue
        const orders = await Order.find().populate("product");

        let totalRevenue = 0;
        orders.forEach(order => {
            if (order.product) {
                totalRevenue += order.product.price * order.quantity;
            }
        });

        res.json({
            totalUsers,
            totalFarmers,
            totalCustomers,
            totalProducts,
            totalOrders,
            totalRevenue
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching stats" });
    }
});

app.get("/admin/users", authMiddleware, isAdmin, async (req, res) => {
    const users = await User.find().select("-password");
    res.json(users);
});

app.delete("/admin/delete-user/:id", authMiddleware, isAdmin, async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
});

app.delete("/delete-product/:id", authMiddleware, isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
});

/* GET NOTIFICATIONS */
app.get("/notifications", authMiddleware, async (req,res)=>{
const notifications = await Notification.find({
user:req.user.id
}).sort({createdAt:-1});
res.json(notifications);
});

/* DELETE PRODUCT (FARMER) */
app.delete("/farmer/delete-product/:id", authMiddleware, async (req,res)=>{
const product = await Product.findById(req.params.id);
if(!product){
return res.status(404).json({message:"Product not found"});
}

if(product.farmer.toString() !== req.user.id){
return res.status(403).json({message:"Not allowed"});
}

await Product.findByIdAndDelete(req.params.id);
res.json({message:"Product deleted successfully"});
});
