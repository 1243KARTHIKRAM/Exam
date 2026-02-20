require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const testRoute = require('./routes/test');
const authRoute = require('./routes/auth');
const examRoute = require('./routes/exams');
const violationRoute = require('./routes/violations');
const adminRoute = require('./routes/admin');
const codingRoute = require('./routes/coding');
const chatbotRoute = require('./routes/chatbot');
const { addQuestion } = require('./controllers/questionController');
const { protect, authorize } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter limit for auth routes
  message: { message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' })); // body-parser with size limit

// connect to MongoDB
connectDB();

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// routes
app.use('/api/auth', authRoute);
app.use('/api/exams', examRoute);
app.use('/api/violations', violationRoute);
app.use('/api/admin', adminRoute);
app.use('/api/code', codingRoute);
app.use('/api/chatbot', chatbotRoute);
app.post('/api/questions/add', protect, authorize('admin'), addQuestion);
app.use('/api/test', testRoute);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
