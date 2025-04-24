const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

require('dotenv').config();

//* Middleware
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//* MongoDB
// Set strictQuery to false to prepare for Mongoose 7
mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

//* Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

//* Models
const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

//* Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Create a new user
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  
  try {
    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json(existingUser);
    }
    
    // Create a new user
    const newUser = new User({ username });
    const savedUser = await newUser.save();
    
    res.json({
      username: savedUser.username,
      _id: savedUser._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating user' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving users' });
  }
});

// Create a new exercise for a user
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;
  
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create exercise with proper date handling
    const exercise = new Exercise({
      userId,
      description,
      duration: parseInt(duration),
      date: date ? new Date(date) : new Date()
    });
    
    await exercise.save();
    
    // Return the response in the required format
    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error adding exercise' });
  }
});

// Get a user's exercise log
app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;
  
  try {
    // Find the user
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build the filter
    const filter = { userId: _id };
    
    // Handle from/to date filters
    if (from || to) {
      filter.date = {};
      if (from) {
        filter.date.$gte = new Date(from);
      }
      if (to) {
        filter.date.$lte = new Date(to);
      }
    }
    
    // Get exercises
    let exercises = await Exercise.find(filter)
      .limit(limit ? parseInt(limit) : undefined)
      .sort({ date: 1 });
      // Format exercises for response
    const log = exercises.map(exercise => ({
      _id: exercise._id,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));
    
    // Return the response in the required format
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving exercise log' });
  }
});

// Helper route to delete all users (for testing)
app.get('/api/users/delete', async (req, res) => {
  console.log('DELETING ALL USERS');
  
  try {
    const result = await User.deleteMany({});
    res.json({ message: 'All users have been deleted!', result });
  } catch (err) {
    console.error(err);
    res.json({ message: 'Deleting all users failed!' });
  }
});

/*
 * GET
 * Delete all exercises
 */
app.get('/api/exercises/delete', async (req, res) => {
  console.log('### DELETE ALL EXERCISES ###');
    try {
    const result = await Exercise.deleteMany({});
    res.json({ message: 'All exercises have been deleted!', result });
  } catch (err) {
    console.error(err);
    res.json({ message: 'Deleting all exercises failed!' });
  }
});

// Added syncIndexes to the main route
app.get('/', async (_req, res) => {
	res.sendFile(__dirname + '/views/index.html');
	await User.syncIndexes();
	await Exercise.syncIndexes();
});

/* Removed duplicate POST /api/users route */

/* Removed duplicate POST /api/users/:_id/exercises route */

/* Removed duplicate GET /api/users/:_id/logs route */

// Start the server (keeping only one app.listen)
const listener = app.listen(process.env.PORT || 3000, () => {
	console.log('Your app is listening on port ' + listener.address().port);
});
