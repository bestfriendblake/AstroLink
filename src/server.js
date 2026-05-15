require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const planetRoutes   = require('./routes/planets');
const petRoutes      = require('./routes/pets');
const gameRoutes     = require('./routes/games');
const dailyRoutes    = require('./routes/dailies');
const currencyRoutes = require('./routes/currency');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
}));

app.use(express.static('public'));

app.use('/api/auth',     authRoutes);
app.use('/api/planets',  planetRoutes);
app.use('/api/pets',     petRoutes);
app.use('/api/games',    gameRoutes);
app.use('/api/dailies',  dailyRoutes);
app.use('/api/currency', currencyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', env: process.env.NODE_ENV });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  const status = err.status || 500;
  const msg    = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message;
  res.status(status).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`[AstroLink] Server running on port ${PORT}`);
});

module.exports = app;