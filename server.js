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
                messages: [],
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

// --- LOGIN CHECK (FIXED) ---
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    const found = db.users.find(u => u.user === user);

    if (!found || found.pass !== pass) {
        return res.status(401).json({ success: false, err: 'بيانات خاطئة' });
    }

    if (db.banned && db.banned.includes(user)) {
        return res.status(403).json({ success: false, err: 'حسابك محظور' });
    }

    // THE FIX: Allow 'admin' role to pass even if status logic is strict
    if (found.role !== 'admin' && found.status === 'pending') {
        return res.status(403).json({ success: false, err: 'حسابك في انتظار تفعيل المدير' });
    }

    const { pass: _, ...userSafe } = found;
    res.json({ success: true, user: userSafe });
});

// --- REGISTRATION ---
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId } = req.body;
    const db = readDB();
    if (db.users.find(u => u.user === user)) return res.status(400).json({ err: 'موجود مسبقاً' });

    db.users.push({
        user, pass, name, wilaya, cardId,
        role: 'student',
        status: 'pending',
        privacy: 'public',
        joinedAt: new Date().toISOString()
    });
    writeDB(db);
    res.json({ success: true });
});

// --- POSTS ---
app.get('/api/posts', (req, res) => res.json(readDB().posts));
app.post('/api/posts', (req, res) => {
    const db = readDB();
    const newPost = { id: Date.now(), author: req.body.author, content: req.body.content };
    db.posts.unshift(newPost);
    writeDB(db);
    res.json({ success: true });
});

// --- MESSAGING ---
app.get('/api/messages/:username', (req, res) => {
    const db = readDB();
    const chats = db.messages.filter(m => m.from === req.params.username || m.to === req.params.username);
    res.json(chats);
});

app.post('/api/messages', (req, res) => {
    const db = readDB();
    db.messages.push({ id: Date.now(), ...req.body, time: new Date().toISOString() });
    writeDB(db);
    res.json({ success: true });
});

// --- ADMIN DATA & ACTIONS ---
app.get('/api/admin/data', (req, res) => res.json(readDB()));

app.post('/api/admin/action', (req, res) => {
    const { type, target } = req.body;
    let db = readDB();
    if (type === 'approve') {
        const u = db.users.find(u => u.user === target);
        if (u) u.status = 'active';
    } else if (type === 'ban') {
        if (!db.banned.includes(target)) db.banned.push(target);
    } else if (type === 'unban') {
        db.banned = db.banned.filter(u => u !== target);
    } else if (type === 'deletePost') {
        db.posts = db.posts.filter(p => p.id.toString() !== target.toString());
    }
    writeDB(db);
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server Fixed & Running'));
