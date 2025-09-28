require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user');
const Module = require('./src/models/module');

const MONGODB_URI = process.env.MONGODB_URI;

const users = [
  {
    name: 'Content_Dev_Admin',
    email: 'content_admin@example.com',
    password: 'admin123',
    role: 'admin',
  },
  {
    name: 'Content_Job_Seaker',
    email: 'job_seaker@example.com',
    password: 'jobseaker123',
    role: 'jobseeker',
  },
];

const modules = [
  {
    title: 'Kitchen Basics',
    description: 'Learn the essentials of kitchen safety and hygiene.',
    assets: [
      { type: 'video', url: 'https://youtu.be/kitchen-basics', title: 'Intro Video', order: 1 },
      { type: 'pdf', url: 'https://example.com/kitchen-basics.pdf', title: 'Kitchen Basics PDF', order: 2 },
    ],
    reactions: [],
    releases: [
      { version: '1.0', notes: 'Initial release' },
    ],
    notifications: [],
  },
  {
    title: 'Accounting Standards',
    description: 'Understand Accounting protocols and standards.',
    assets: [
      { type: 'video', url: 'https://youtu.be/Accounting-standards', title: 'Accounting Video', order: 1 },
      { type: 'text', text: 'Always use gloves and approved Accounting agents.', title: 'Accounting Tips', order: 2 },
    ],
    reactions: [],
    releases: [
      { version: '1.0', notes: 'Initial release' },
    ],
    notifications: [],
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Upsert users
  const userDocs = [];
  for (const user of users) {
    const doc = await User.findOneAndUpdate(
      { email: user.email },
      user,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    userDocs.push(doc);
  }

  // Add a like reaction from job seeker to first module
  modules[0].reactions.push({ user: userDocs[1]._id, type: 'like' });
  // Add notification for job seeker
  modules[0].notifications.push({ user: userDocs[1]._id, message: 'New module released: Kitchen Basics' });

  // Upsert modules
  for (const mod of modules) {
    await Module.findOneAndUpdate(
      { title: mod.title },
      mod,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log('Seeded modules and users.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
