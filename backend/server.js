require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const submissionsRouter = require('./routes/submissions');
const authRouter = require('./routes/auth');

const app = express();

// credentials: true + an explicit origin (not '*') is required for the
// httpOnly session cookie to be sent/accepted cross-origin from Vite's dev server.
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/submissions', submissionsRouter);

app.get('/', (req, res) => {
  res.send('Copy/Assignment Checking API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});