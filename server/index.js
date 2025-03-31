require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ipl-streaming', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Models
const User = mongoose.model('User', {
  username: String,
  password: String,
  role: { type: String, default: 'admin' }
});

const Stream = mongoose.model('Stream', {
  title: String,
  url: String,
  isActive: Boolean,
  createdAt: { type: Date, default: Date.now }
});

const Ad = mongoose.model('Ad', {
  position: String,
  code: String,
  isActive: Boolean
});

const Setting = mongoose.model('Setting', {
  siteTitle: String,
  telegramLink: String,
  shareTimer: Number,
  maintenanceMode: Boolean
});

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findOne({ _id: decoded._id });
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch (e) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

// Routes

// Auth Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).send({ error: 'Invalid credentials' });
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secret');
  res.send({ user, token });
});

// Stream Management
app.get('/api/streams', authenticate, async (req, res) => {
  const streams = await Stream.find().sort({ createdAt: -1 });
  res.send(streams);
});

app.post('/api/streams', authenticate, async (req, res) => {
  const stream = new Stream(req.body);
  await stream.save();
  res.status(201).send(stream);
});

app.put('/api/streams/:id', authenticate, async (req, res) => {
  const stream = await Stream.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.send(stream);
});

app.delete('/api/streams/:id', authenticate, async (req, res) => {
  await Stream.findByIdAndDelete(req.params.id);
  res.send({ message: 'Stream deleted' });
});

// Ad Management
app.get('/api/ads', authenticate, async (req, res) => {
  const ads = await Ad.find();
  res.send(ads);
});

app.post('/api/ads', authenticate, async (req, res) => {
  const ad = new Ad(req.body);
  await ad.save();
  res.status(201).send(ad);
});

app.put('/api/ads/:id', authenticate, async (req, res) => {
  const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.send(ad);
});

// Settings
app.get('/api/settings', authenticate, async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting({
      siteTitle: 'IPL Live Streaming',
      telegramLink: 'https://t.me/yourchannel',
      shareTimer: 300,
      maintenanceMode: false
    });
    await settings.save();
  }
  res.send(settings);
});

app.put('/api/settings', authenticate, async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting(req.body);
  } else {
    settings = await Setting.findOneAndUpdate({}, req.body, { new: true });
  }
  res.send(settings);
});

// Public API for frontend
app.get('/api/public/streams', async (req, res) => {
  const settings = await Setting.findOne();
  if (settings?.maintenanceMode) {
    return res.status(503).send({ message: 'Site under maintenance' });
  }
  const streams = await Stream.find({ isActive: true });
  res.send(streams);
});

app.get('/api/public/ads', async (req, res) => {
  const ads = await Ad.find({ isActive: true });
  res.send(ads);
});

app.get('/api/public/settings', async (req, res) => {
  const settings = await Setting.findOne();
  res.send(settings);
});

// Initialize Admin User
const initializeAdmin = async () => {
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 8);
    const admin = new User({
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('Default admin created: admin/admin123');
  }
};

// Serve frontend files
app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeAdmin();
  console.log(`Server running on port ${PORT}`);
});
