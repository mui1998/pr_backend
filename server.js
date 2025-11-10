import express from "express";
import connectDB from './db.js';
import userRoutes from "./routes/userRoutes.js";
import cors from 'cors';
import prRoutes from './routes/prRoutes.js';  // Assuming you have a separate prRoutes.js

// Connect to MongoDB
connectDB();

// Initialize the Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/pr', prRoutes);  // Routes for Purchase Requests
app.use('/auth', userRoutes);   // Routes for Authentication

// Test route
app.get('/', (req, res) => {
    res.send('Hello from Express');
});

// Set the port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
