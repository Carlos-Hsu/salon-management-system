const { openDatabase } = require('./database');
module.exports = openDatabase(process.env.DB_PATH);
