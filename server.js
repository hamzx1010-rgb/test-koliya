const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

// --- DATABASE CORE ---
const readDB = () => {
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
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- AUTHENTICATION (The "User Taken" Fix) ---
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId } = req.body;
    const db = readDB();

    // Check if username is truly taken
    const exists = db.users.find(u => u.user.toLowerCase() === user.toLowerCase());
    if (exists) {
        return res.status(400).json({ success: false, err: 'اسم المستخدم محجوز بالفعل' });
    }

    // Add new student as PENDING
    const newUser = {
        user: user.trim(),
        pass: pass.trim(),
        name: name.trim(),
        wilaya,
        cardId,
        role: 'student',
        status: 'pending', // This ensures it hits the Admin Page
        privacy: 'public',
        joinedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);
    console.log(`New Request: ${user} is now pending approval.`);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    const found = db.users.find(u => u.user.toLowerCase() === user.toLowerCase());

    if (!found || found.pass !== pass) {
        return res.status(401).json({ success: false, err: 'خطأ في اسم المستخدم أو كلمة السر' });
    }

    // Admin always gets in
    if (found.role === 'admin') {
        return res.json({ success: true, user: found });
    }

    // Check Student specific blocks
    if (db.banned.includes(found.user)) return res.status(403).json({ success: false, err: 'حسابك محظور' });
    if (found.status === 'pending') return res.status(403).json({ success: false, err: 'بانتظار موافقة المدير' });

    res.json({ success: true, user: found });
});

// --- POSTS SYSTEM ---
app.get('/api/posts', (req, res) => {
    res.json(readDB().posts);
});

app.post('/api/posts', (req, res) => {
    const db = readDB();
    const newPost = { 
        id: Date.now(), 
        author: req.body.author, 
        content: req.body.content,
        time: new Date().toISOString() 
    };
    db.posts.unshift(newPost);
    writeDB(db);
    res.json({ success: true });
});

// --- DM MESSAGING SYSTEM ---
app.get('/api/messages/:username', (req, res) => {
    const db = readDB();
    const myChats = db.messages.filter(m => m.from === req.params.username || m.to === req.params.username);
    res.json(myChats);
});

app.post('/api/messages', (req, res) => {
    const db = readDB();
    const msg = { 
        id: Date.now(), 
        from: req.body.from, 
        to: req.body.to, 
        text: req.body.text, 
        time: new Date().toISOString() 
    };
    db.messages.push(msg);
    writeDB(db);
    res.json({ success: true });
});

// --- ADMIN COMMAND CENTER API ---
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

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

// --- PROFILE PRIVACY ---
app.get('/api/user/:username', (req, res) => {
    const db = readDB();
    const u = db.users.find(u => u.user === req.params.username);
    if (!u) return res.status(404).send();
    const { pass, ...safe } = u;
    res.json(safe);
});

app.post('/api/user/update-privacy', (req, res) => {
    const db = readDB();
    const u = db.users.find(u => u.user === req.body.user);
    if (u) {
        u.privacy = req.body.privacy;
        writeDB(db);
        res.json({ success: true });
    }
});

app.listen(3000, () => console.log('COMMAND CENTER ENGINE ONLINE'));
