const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { 
                users: [{ user: 'admin', pass: 'owner2026', name: 'المدير', role: 'admin', status: 'active', privacy: 'public' }], 
                posts: [], 
                messages: [], // New: Storage for private DMs
                banned: [] 
            };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        return { users: [], posts: [], messages: [], banned: [] };
    }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- POST SYNCHRONIZATION ---
app.get('/api/posts', (req, res) => {
    const db = readDB();
    res.json(db.posts);
});

app.post('/api/posts', (req, res) => {
    const { author, content } = req.body;
    const db = readDB();
    const newPost = {
        id: Date.now(),
        author,
        content,
        timestamp: new Date().toISOString()
    };
    db.posts.unshift(newPost);
    writeDB(db);
    res.json({ success: true, post: newPost });
});

// --- PRIVATE MESSAGING SYSTEM (DM) ---

// Get all conversations for a specific user
app.get('/api/messages/:username', (req, res) => {
    const db = readDB();
    const myUser = req.params.username;
    // Filters messages where the user is either the sender or receiver
    const myChats = db.messages.filter(m => m.from === myUser || m.to === myUser);
    res.json(myChats);
});

// Send a private message
app.post('/api/messages', (req, res) => {
    const { from, to, text } = req.body;
    const db = readDB();
    
    // Check if receiver exists and is not private (unless they are already friends/contacts)
    const receiver = db.users.find(u => u.user === to);
    if (!receiver) return res.status(404).json({ err: 'المستخدم غير موجود' });

    const newMessage = {
        id: Date.now(),
        from,
        to,
        text,
        time: new Date().toISOString()
    };
    
    db.messages.push(newMessage);
    writeDB(db);
    res.json({ success: true });
});

// --- PROFILE & PRIVACY ---
app.post('/api/user/update-privacy', (req, res) => {
    const { user, privacy } = req.body; // privacy: 'public' or 'private'
    const db = readDB();
    const u = db.users.find(u => u.user === user);
    if (u) {
        u.privacy = privacy;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).send();
    }
});

// Search/Get Profile info
app.get('/api/user/:username', (req, res) => {
    const db = readDB();
    const u = db.users.find(u => u.user === req.params.username);
    if (!u) return res.status(404).send();
    
    // Don't send password
    const { pass, ...safeUser } = u;
    res.json(safeUser);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server synchronized on port ${PORT}`));
