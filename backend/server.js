const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql');

dotenv.config();

const app = express();

// In-memory cache setup
let jokesCache = {
  data: [],
  lastUpdated: null,
  isValid: false
};

const CACHE_DURATION = 5 * 60 * 1000;

// CORS configuration
app.use(cors({
  origin: ['https://Aman-localhost.onrender.com', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "frontend", "dist")));

// Database connection
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Cache functions
const isCacheValid = () => {
  return jokesCache.isValid &&
    jokesCache.lastUpdated &&
    (Date.now() - jokesCache.lastUpdated) < CACHE_DURATION;
};

const updateCache = (data) => {
  jokesCache = {
    data: data,
    lastUpdated: Date.now(),
    isValid: true
  };
};

// Database fetch function
const fetchJokesFromDB = async () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting database connection:', err);
        reject(new Error('Database connection error'));
        return;
      }

      connection.query('SELECT * FROM jokes', (error, results) => {
        connection.release();
        if (error) {
          console.error('Error fetching jokes:', error);
          reject(new Error('Database query error'));
          return;
        }
        resolve(results);
      });
    });
  });
};

// API Routes
app.get('/post', async (req, res) => {
  try {
    if (isCacheValid()) {
      return res.json(jokesCache.data);
    }

    const jokes = await fetchJokesFromDB();
    updateCache(jokes);
    res.json(jokes);
  } catch (error) {
    console.error('Error:', error);
    
    if (jokesCache.data.length > 0) {
      return res.json(jokesCache.data);
    }
    
    res.status(500).json({ 
      error: 'Server error',
      message: 'Please try again later'
    });
  }
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
