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

// --- REGISTRATION ---
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.user === user)) {
        return res.status(400).json({ success: false, err: 'المستخدم موجود' });
    }

    db.users.push({
        user, pass, name, wilaya, cardId,
        role: 'student',
        status: 'pending',
        joinedAt: new Date().toISOString()
    });
    
    writeDB(db);
    res.json({ success: true });
});

// --- FIXED LOGIN ---
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    
    // Find the user by username
    const found = db.users.find(u => u.user === user);

    // 1. Check if user exists and password matches
    if (!found || found.pass !== pass) {
        return res.status(401).json({ success: false, err: 'اسم المستخدم أو كلمة السر خاطئة' });
    }

    // 2. Check if banned
    if (db.banned && db.banned.includes(user)) {
        return res.status(403).json({ success: false, err: 'عذراً، تم حظر حسابك من قبل الإدارة' });
    }

    // 3. Check if still pending (Not yet approved by Admin)
    if (found.status === 'pending') {
        return res.status(403).json({ success: false, err: 'حسابك في انتظار تفعيل المدير. يرجى المحاولة لاحقاً' });
    }

    // 4. Success - Send back user info (minus the password for security)
    const { pass: _, ...userSafe } = found;
    res.json({ success: true, user: userSafe });
});

// --- ADMIN DATA ---
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

// --- ADMIN ACTIONS ---
app.post('/api/admin/action', (req, res) => {
    const { type, target } = req.body;
    let db = readDB();

    if (type === 'approve') {
        const u = db.users.find(u => u.user === target);
        if (u) u.status = 'active';
    } 
    else if (type === 'ban') {
        if (!db.banned.includes(target)) db.banned.push(target);
    } 
    else if (type === 'unban') {
        db.banned = db.banned.filter(u => u !== target);
    }

    writeDB(db);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
