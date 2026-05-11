const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

// Initialize database structure
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { 
                users: [{ user: 'admin', pass: 'owner2026', name: 'المدير', role: 'admin', status: 'active' }], 
                posts: [], 
                banned: [] 
            };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        return { users: [], posts: [], banned: [] };
    }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- AUTHENTICATION ---

app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.user === user)) {
        return res.status(400).json({ success: false, err: 'المستخدم موجود' });
    }

    db.users.push({
        user, pass, name, wilaya, cardId,
        role: 'student',
        status: 'pending', // Visible in Command Center
        joinedAt: new Date().toISOString()
    });
    
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    const found = db.users.find(u => u.user === user && u.pass === pass);

    if (!found) return res.status(401).json({ success: false, err: 'بيانات خاطئة' });
    if (db.banned.includes(user)) return res.status(403).json({ success: false, err: 'حسابك محظور' });
    if (found.status === 'pending') return res.status(403).json({ success: false, err: 'الحساب قيد المراجعة' });

    res.json({ success: true, user: found });
});

// --- FEED LOGIC ---

app.get('/api/posts', (req, res) => {
    res.json(readDB().posts);
});

app.post('/api/posts', (req, res) => {
    const { author, content } = req.body;
    const db = readDB();
    db.posts.unshift({
        id: Date.now(),
        author,
        content,
        timestamp: new Date().toISOString()
    });
    writeDB(db);
    res.json({ success: true });
});

// --- COMMAND CENTER (ADMIN) LOGIC ---

app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

app.post('/api/admin/action', (req, res) => {
    const { type, target } = req.body;
    let db = readDB();

    switch(type) {
        case 'approve':
            const user = db.users.find(u => u.user === target);
            if (user) user.status = 'active';
            break;
        case 'ban':
            if (!db.banned.includes(target)) db.banned.push(target);
            break;
        case 'unban':
            db.banned = db.banned.filter(u => u !== target);
            break;
        case 'deletePost':
            db.posts = db.posts.filter(p => p.id.toString() !== target.toString());
            break;
        case 'makeAdmin':
            const u = db.users.find(u => u.user === target);
            if (u) u.role = 'admin';
            break;
    }

    writeDB(db);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Koliya Command Center Active on Port ${PORT}`));
