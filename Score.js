const mongoose = require('mongoose');
const ScoreSchema = new mongoose.Schema({
  grade: String,
  strand: String,
  file: String,
  date: String,
  score: Number,
  total: Number
});
module.exports = mongoose.model('Score', ScoreSchema);