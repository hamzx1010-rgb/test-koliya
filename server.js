const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

// --- DB HELPERS ---
const readDB = () => {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        return { users: [], posts: [], busSchedules: {}, banned: [] };
    }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- ROUTES ---

// 1. Home Redirect
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 2. Multi-Step Registration
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId, bacId } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.user === user)) {
        return res.status(400).json({ err: 'المستخدم موجود بالفعل' });
    }

    const newUser = {
        user, pass, name, wilaya, cardId, bacId,
        role: 'student',
        status: 'pending', // Waiting for admin approval
        isVerified: false,
        joinedAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true });
});

// 3. Login
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    const found = db.users.find(u => u.user === user && u.pass === pass);

    if (!found) return res.status(401).json({ success: false });
    if (found.status === 'pending') return res.status(403).json({ err: 'بانتظار التفعيل' });
    if (db.banned.includes(user)) return res.status(403).json({ err: 'محظور' });

    res.json({ success: true, user: found });
});

// 4. Admin: Approve Student
app.post('/api/admin/approve', (req, res) => {
    const { targetUser } = req.body;
    const db = readDB();
    const uIndex = db.users.findIndex(u => u.user === targetUser);
    
    if (uIndex !== -1) {
        db.users[uIndex].status = 'active';
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ err: 'User not found' });
    }
});

// 5. Admin: Update Bus (COUS)
app.post('/api/admin/bus-update', (req, res) => {
    const { wilaya, time } = req.body;
    const db = readDB();
    if (!db.busSchedules) db.busSchedules = {};
    db.busSchedules[wilaya] = time;
    writeDB(db);
    res.json({ success: true });
});

// 6. Social Feed
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

// 7. Admin Data Fetch
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Koliya Running on ${PORT}`));