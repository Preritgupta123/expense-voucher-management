const { authenticate, authorize } = require('./middleware/auth');

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Allow the React app (a different port) to call this API
app.use(cors({ origin: process.env.CLIENT_URL }));
// Read JSON bodies into req.body
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/vouchers', require('./routes/vouchers'));

// Unknown URL
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Unknown URL
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Any error passed with next(err) lands here: one place for error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));