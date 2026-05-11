const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = path.join(__dirname, 'db.json');

const readDB = () => {
    if (!fs.existsSync(DB_PATH)) {
        const init = { users: [{ user: 'admin', pass: 'owner2026', role: 'admin', status: 'active' }], posts: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
        return init;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// Registration endpoint
app.post('/api/register', (req, res) => {
    const db = readDB();
    const newUser = { ...req.body, role: 'student', status: 'pending' };
    if (db.users.find(u => u.user === newUser.user)) return res.status(400).send();
    db.users.push(newUser);
    writeDB(db);
    res.status(200).send();
});

// Admin data endpoint (Independent)
app.get('/api/admin/requests', (req, res) => {
    const db = readDB();
    const pending = db.users.filter(u => u.status === 'pending');
    res.json(pending);
});

// Approval endpoint
app.post('/api/admin/approve', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u.user === req.body.user);
    if (user) user.status = 'active';
    writeDB(db);
    res.status(200).send();
});

app.listen(3000);
