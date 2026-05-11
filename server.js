const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

const readDB = () => {
    if (!fs.existsSync(DB_PATH)) {
        const init = { users: [{ user: 'admin', pass: 'owner2026', role: 'admin', status: 'active' }], posts: [], banned: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
        return init;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// 1. Registration (Ensuring keys match the frontend)
app.post('/api/register', (req, res) => {
    const db = readDB();
    const { user, pass, name, wilaya, cardId } = req.body;
    
    if (db.users.find(u => u.user === user)) return res.status(400).json({ err: 'المستخدم موجود' });

    db.users.push({
        user, pass, name, wilaya, cardId,
        role: 'student',
        status: 'pending',
        joinedAt: new Date().toISOString()
    });
    
    writeDB(db);
    res.json({ success: true });
});

// 2. Admin: Get Data
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

// 3. Admin: Unified Actions
app.post('/api/admin/action', (req, res) => {
    const { type, target } = req.body;
    const db = readDB();

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
    else if (type === 'deletePost') {
        db.posts = db.posts.filter(p => p.id.toString() !== target.toString());
    }

    writeDB(db);
    res.json({ success: true });
});

app.listen(3000, () => console.log('Command Center Online on 3000'));
