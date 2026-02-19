require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const testRoute = require('./routes/test');

const app = express();

// middleware
app.use(cors());
app.use(express.json()); // body-parser built-in

// connect to MongoDB
connectDB();

// routes
app.use('/api/test', testRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
