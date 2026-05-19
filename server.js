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
            users: [{ user: 'admin', pass: 'owner2026', name: 'المدير', role: 'admin', status: 'active', privacy: 'public', followers: [], following: [] }],
            posts: [],
            messages: [],
            reports: [],
            banned: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// Ensure all users have required fields on read
const safeUser = (u) => ({
    ...u,
    followers: u.followers || [],
    following: u.following || [],
    blockedUsers: u.blockedUsers || [],
    blockedBy: u.blockedBy || [],
});

// --- AUTHENTICATION ---
app.post('/api/register', (req, res) => {
    const { user, pass, name, wilaya, cardId } = req.body;
    const db = readDB();

    const exists = db.users.find(u => u.user.toLowerCase() === user.toLowerCase());
    if (exists) return res.status(400).json({ success: false, err: 'اسم المستخدم محجوز بالفعل' });

    const newUser = {
        user: user.trim(),
        pass: pass.trim(),
        name: name.trim(),
        wilaya,
        cardId,
        role: 'student',
        status: 'pending',
        privacy: 'public',
        followers: [],
        following: [],
        blockedUsers: [],
        blockedBy: [],
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

    if (!found || found.pass !== pass)
        return res.status(401).json({ success: false, err: 'خطأ في اسم المستخدم أو كلمة السر' });

    if (found.role === 'admin')
        return res.json({ success: true, user: safeUser(found) });

    if (db.banned.includes(found.user))
        return res.status(403).json({ success: false, err: 'حسابك محظور' });
    if (found.status === 'pending')
        return res.status(403).json({ success: false, err: 'بانتظار موافقة المدير' });

    res.json({ success: true, user: safeUser(found) });
});

// --- POSTS SYSTEM ---
app.get('/api/posts', (req, res) => {
    const db = readDB();
    let posts = db.posts;

    // Filter by following if query param provided
    if (req.query.following) {
        const me = db.users.find(u => u.user === req.query.following);
        const followingList = me?.following || [];
        posts = posts.filter(p => followingList.includes(p.author));
    }

    res.json(posts);
});

app.post('/api/posts', (req, res) => {
    const db = readDB();
    const newPost = {
        id: Date.now(),
        author: req.body.author,
        content: req.body.content,
        likes: 0,
        likedBy: [],
        comments: 0,
        reposts: 0,
        repostedBy: [],
        time: new Date().toISOString()
    };
    db.posts.unshift(newPost);
    writeDB(db);
    res.json({ success: true, post: newPost });
});

// --- LIKES ---
app.post('/api/posts/:id/like', (req, res) => {
    const db = readDB();
    const post = db.posts.find(p => p.id.toString() === req.params.id.toString());
    if (!post) return res.status(404).json({ success: false });

    post.likedBy = post.likedBy || [];
    const user = req.body.user;
    const idx = post.likedBy.indexOf(user);

    if (idx === -1) {
        post.likedBy.push(user);
        post.likes = post.likedBy.length;

        // Notification for post author
        if (post.author !== user) {
            db.notifications = db.notifications || [];
            db.notifications.unshift({
                id: Date.now(),
                for: post.author,
                from: user,
                type: 'like',
                postId: post.id,
                read: false,
                time: new Date().toISOString()
            });
        }
    } else {
        post.likedBy.splice(idx, 1);
        post.likes = post.likedBy.length;
    }

    writeDB(db);
    res.json({ success: true, likes: post.likes, liked: idx === -1 });
});

// --- REPOSTS ---
app.post('/api/posts/:id/repost', (req, res) => {
    const db = readDB();
    const post = db.posts.find(p => p.id.toString() === req.params.id.toString());
    if (!post) return res.status(404).json({ success: false });

    post.repostedBy = post.repostedBy || [];
    const user = req.body.user;
    const idx = post.repostedBy.indexOf(user);

    if (idx === -1) {
        post.repostedBy.push(user);
        post.reposts = post.repostedBy.length;

        // Add repost entry at top of feed
        const repostEntry = {
            id: Date.now(),
            author: post.author,
            content: post.content,
            repostedBy: user,
            originalId: post.id,
            likes: 0,
            likedBy: [],
            comments: 0,
            reposts: 0,
            repostedByList: [user],
            time: new Date().toISOString()
        };
        db.posts.unshift(repostEntry);

        // Notification
        if (post.author !== user) {
            db.notifications = db.notifications || [];
            db.notifications.unshift({
                id: Date.now() + 1,
                for: post.author,
                from: user,
                type: 'repost',
                postId: post.id,
                read: false,
                time: new Date().toISOString()
            });
        }
    } else {
        post.repostedBy.splice(idx, 1);
        post.reposts = post.repostedBy.length;
    }

    writeDB(db);
    res.json({ success: true, reposts: post.reposts });
});

// --- FOLLOW / UNFOLLOW ---
app.post('/api/follow', (req, res) => {
    const { from, to, action } = req.body;
    if (!from || !to || from === to) return res.status(400).json({ success: false });

    const db = readDB();
    const fromUser = db.users.find(u => u.user === from);
    const toUser = db.users.find(u => u.user === to);
    if (!fromUser || !toUser) return res.status(404).json({ success: false });

    fromUser.following = fromUser.following || [];
    toUser.followers = toUser.followers || [];

    if (action === 'follow') {
        if (!fromUser.following.includes(to)) fromUser.following.push(to);
        if (!toUser.followers.includes(from)) toUser.followers.push(from);

        // Notification
        db.notifications = db.notifications || [];
        db.notifications.unshift({
            id: Date.now(),
            for: to,
            from: from,
            type: 'follow',
            read: false,
            time: new Date().toISOString()
        });
    } else {
        fromUser.following = fromUser.following.filter(u => u !== to);
        toUser.followers = toUser.followers.filter(u => u !== from);
    }

    writeDB(db);
    res.json({
        success: true,
        followers: toUser.followers.length,
        following: fromUser.following.length
    });
});

// --- BLOCK ---
app.post('/api/block', (req, res) => {
    const { from, target } = req.body;
    const db = readDB();
    const fromUser = db.users.find(u => u.user === from);
    const targetUser = db.users.find(u => u.user === target);
    if (!fromUser || !targetUser) return res.status(404).json({ success: false });

    fromUser.blockedUsers = fromUser.blockedUsers || [];
    targetUser.blockedBy = targetUser.blockedBy || [];

    if (!fromUser.blockedUsers.includes(target)) fromUser.blockedUsers.push(target);
    if (!targetUser.blockedBy.includes(from)) targetUser.blockedBy.push(from);

    // Also unfollow both ways
    fromUser.following = (fromUser.following || []).filter(u => u !== target);
    targetUser.following = (targetUser.following || []).filter(u => u !== from);
    fromUser.followers = (fromUser.followers || []).filter(u => u !== target);
    targetUser.followers = (targetUser.followers || []).filter(u => u !== from);

    writeDB(db);
    res.json({ success: true });
});

// --- REPORT ---
app.post('/api/report', (req, res) => {
    const { from, target, reason } = req.body;
    const db = readDB();

    db.reports = db.reports || [];
    db.reports.push({
        id: Date.now(),
        from,
        target,
        reason: reason || '',
        time: new Date().toISOString(),
        status: 'pending'
    });

    writeDB(db);
    res.json({ success: true });
});

// --- NOTIFICATIONS ---
app.get('/api/notifications', (req, res) => {
    const db = readDB();
    const user = req.query.user;
    if (!user) return res.status(400).json([]);

    const notifs = (db.notifications || [])
        .filter(n => n.for === user)
        .slice(0, 50); // latest 50

    res.json(notifs);
});

app.post('/api/notifications/read', (req, res) => {
    const { user } = req.body;
    const db = readDB();
    db.notifications = db.notifications || [];
    db.notifications.forEach(n => { if (n.for === user) n.read = true; });
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

    // Notification for DM
    db.notifications = db.notifications || [];
    db.notifications.unshift({
        id: Date.now() + 1,
        for: req.body.to,
        from: req.body.from,
        type: 'message',
        read: false,
        time: new Date().toISOString()
    });

    writeDB(db);
    res.json({ success: true });
});

// --- ADMIN COMMAND CENTER API ---
app.get('/api/admin/data', (req, res) => {
    res.json(readDB());
});

app.post('/api/admin/action', (req, res) => {
    const { type, target } = req.body;
    const db = readDB();

    if (type === 'approve') {
        const u = db.users.find(u => u.user === target);
        if (u) u.status = 'active';
    } else if (type === 'ban') {
        if (!db.banned.includes(target)) db.banned.push(target);
    } else if (type === 'unban') {
        db.banned = db.banned.filter(u => u !== target);
    } else if (type === 'deletePost') {
        db.posts = db.posts.filter(p => p.id.toString() !== target.toString());
    } else if (type === 'resolveReport') {
        const r = db.reports?.find(r => r.id.toString() === target.toString());
        if (r) r.status = 'resolved';
    }

    writeDB(db);
    res.json({ success: true });
});

// --- PROFILE ---
app.get('/api/user/:username', (req, res) => {
    const db = readDB();
    const u = db.users.find(u => u.user === req.params.username);
    if (!u) return res.status(404).send();
    const { pass, ...safe } = safeUser(u);
    res.json(safe);
});

app.post('/api/user/update-privacy', (req, res) => {
    const db = readDB();
    const u = db.users.find(u => u.user === req.body.user);
    if (u) {
        u.privacy = req.body.privacy;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post('/api/user/update-bio', (req, res) => {
    const { user, bio } = req.body;
    const db = readDB();
    const u = db.users.find(u => u.user === user);
    if (u) {
        u.bio = bio;
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.listen(3000, () => console.log('KOLIYA ENGINE ONLINE ✓'));
