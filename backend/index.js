require('dotenv').config();
const db = require('./db');
const { createApp } = require('./app');
const port = process.env.PORT || 5000;
createApp(db).listen(port, '0.0.0.0', () => console.log(`Salon API listening on ${port}`));
