const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

// Database Initialization
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = { 
                users: [{ user: 'admin', pass: 'owner2026', name: 'المدير', role: 'admin', status: 'active' }], 
                posts: [], 
                busSchedules: {}, 
                banned: [] 
            };
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        return { users: [], posts: [], busSchedules: {}, banned: [] };
    }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// 1. Registration (Sending request to Admin)
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId, bacId } = req.body;
    const db = readDB();
    
    if (db.users.find(u => u.user === user)) {
        return res.status(400).json({ success: false, err: 'المستخدم موجود بالفعل' });
    }

    db.users.push({
        user, pass, name, wilaya, cardId, bacId,
        role: 'student',
        status: 'pending', // Key for admin visibility
        joinedAt: new Date().toISOString()
    });
    
    writeDB(db);
    res.json({ success: true });
});

// 2. Login Logic
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const db = readDB();
    const found = db.users.find(u => u.user === user && u.pass === pass);

    if (!found) return res.status(401).json({ success: false, err: 'خطأ في البيانات' });
    if (found.status === 'pending') return res.status(403).json({ success: false, err: 'بانتظار التفعيل' });
    
    res.json({ success: true, user: found });
});

// 3. Admin: Fetch All Data (including pending requests)
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

// 4. Admin: Approve Student
app.post('/api/admin/approve', (req, res) => {
    const { targetUser } = req.body;
    const db = readDB();
    const idx = db.users.findIndex(u => u.user === targetUser);
    
    if (idx !== -1) {
        db.users[idx].status = 'active';
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Koliya Backend running on port ${PORT}`));
