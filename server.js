// 必要なモジュールをインポート
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const http = require('http');

// アプリケーションのセットアップ
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// ディレクトリパスの設定
const VIDEOS_DIR = path.join(__dirname, 'uploads', 'videos');
const THUMBS_DIR = path.join(__dirname, 'uploads', 'thumbnails');

// 必要なディレクトリを作成
[VIDEOS_DIR, THUMBS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multerの設定（ファイルアップロード）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB制限
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Invalid format'));
  }
});

// データストア（本番環境ではデータベースを使用）
const videos = [];
const comments = {};
const likes = {};
const views = {};

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

// メインページ
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VideoTube</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #181818;
      color: #fff;
    }
    
    header {
      background: #202020;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 5px rgba(0,0,0,.5);
    }
    
    header h1 {
      font-size: 24px;
      color: #ff0000;
      cursor: pointer;
    }
    
    .search-bar {
      flex: 1;
      max-width: 600px;
      margin: 0 40px;
    }
    
    .search-bar input {
      width: 100%;
      padding: 10px 15px;
      border: 1px solid #303030;
      background: #121212;
      color: #fff;
      border-radius: 2px;
      font-size: 16px;
    }
    
    .search-bar input:focus {
      outline: none;
      border-color: #1c62b9;
    }
    
    .upload-btn {
      background: #ff0000;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 2px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: .2s;
    }
    
    .upload-btn:hover {
      background: #cc0000;
    }
    
    .container {
      max-width: 1800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .video-card {
      background: #202020;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: .2s;
    }
    
    .video-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0,0,0,.5);
    }
    
    .video-thumbnail {
      width: 100%;
      aspect-ratio: 16/9;
      background: #000;
      position: relative;
      overflow: hidden;
    }
    
    .video-thumbnail video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .video-info {
      padding: 12px;
    }
    
    .video-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .video-meta {
      font-size: 13px;
      color: #aaa;
    }
    
    .upload-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .upload-modal.active {
      display: flex;
    }
    
    .upload-content {
      background: #282828;
      padding: 30px;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
    }
    
    .upload-content h2 {
      margin-bottom: 20px;
    }
    
    .upload-content input,
    .upload-content textarea {
      width: 100%;
      padding: 12px;
      margin: 10px 0;
      background: #181818;
      border: 1px solid #303030;
      color: #fff;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .upload-content textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .upload-content button {
      background: #ff0000;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 2px;
      cursor: pointer;
      font-weight: 600;
      margin-right: 10px;
      margin-top: 10px;
    }
    
    .upload-content button:hover {
      background: #cc0000;
    }
    
    .cancel-btn {
      background: #606060 !important;
    }
    
    .cancel-btn:hover {
      background: #505050 !important;
    }
    
    .player-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,.95);
      z-index: 1000;
    }
    
    .player-modal.active {
      display: block;
    }
    
    .player-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      height: 100%;
    }
    
    .close-player {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,.7);
      color: #fff;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 24px;
      z-index: 10;
    }
    
    .close-player:hover {
      background: rgba(0,0,0,.9);
    }
    
    .player-video {
      width: 100%;
      max-height: 70vh;
      background: #000;
      border-radius: 8px;
    }
    
    .player-details {
      margin-top: 20px;
    }
    
    .player-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .player-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #303030;
    }
    
    .stats-left {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: #aaa;
    }
    
    .stats-right {
      display: flex;
      gap: 15px;
    }
    
    .action-btn {
      background: #3f3f3f;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 18px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: .2s;
    }
    
    .action-btn:hover {
      background: #4f4f4f;
    }
    
    .action-btn.liked {
      background: #ff0000;
    }
    
    .comments-section {
      margin-top: 30px;
    }
    
    .comments-section h3 {
      margin-bottom: 20px;
      font-size: 20px;
    }
    
    .comment-input {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }
    
    .comment-input input {
      flex: 1;
      padding: 10px;
      background: #181818;
      border: 1px solid #303030;
      color: #fff;
      border-radius: 4px;
    }
    
    .comment-input button {
      background: #ff0000;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 2px;
      cursor: pointer;
    }
    
    .comment-item {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .comment-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #606060;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }
    
    .comment-content {
      flex: 1;
    }
    
    .comment-author {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    
    .comment-text {
      font-size: 14px;
      color: #ccc;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <header>
    <h1 onclick="location.reload()">📺 VideoTube</h1>
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="検索">
    </div>
    <button class="upload-btn" onclick="openUploadModal()">📤 アップロード</button>
  </header>

  <div class="container">
    <div class="video-grid" id="videoGrid"></div>
  </div>

  <div class="upload-modal" id="uploadModal">
    <div class="upload-content">
      <h2>動画をアップロード</h2>
      <input type="file" id="videoFile" accept="video/*" required>
      <input type="text" id="videoTitle" placeholder="タイトル" required>
      <textarea id="videoDescription" placeholder="説明"></textarea>
      <button onclick="uploadVideo()">アップロード</button>
      <button class="cancel-btn" onclick="closeUploadModal()">キャンセル</button>
    </div>
  </div>

  <div class="player-modal" id="playerModal">
    <button class="close-player" onclick="closePlayer()">×</button>
    <div class="player-container">
      <video class="player-video" id="playerVideo" controls></video>
      <div class="player-details">
        <h2 class="player-title" id="playerTitle"></h2>
        <div class="player-stats">
          <div class="stats-left">
            <span id="viewCount">0 回視聴</span>
            <span id="uploadDate"></span>
          </div>
          <div class="stats-right">
            <button class="action-btn" id="likeBtn" onclick="toggleLike()">
              <span>👍</span>
              <span id="likeCount">0</span>
            </button>
            <button class="action-btn">
              <span>💾</span>
              <span>保存</span>
            </button>
            <button class="action-btn">
              <span>📤</span>
              <span>共有</span>
            </button>
          </div>
        </div>
        <div class="comments-section">
          <h3>コメント <span id="commentCount">0</span></h3>
          <div class="comment-input">
            <input type="text" id="commentInput" placeholder="コメントを追加...">
            <button onclick="postComment()">送信</button>
          </div>
          <div id="commentsList"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentVideoId = null;
    let userLikes = new Set();

    function openUploadModal() {
      document.getElementById('uploadModal').classList.add('active');
    }

    function closeUploadModal() {
      document.getElementById('uploadModal').classList.remove('active');
    }

    async function uploadVideo() {
      const file = document.getElementById('videoFile').files[0];
      const title = document.getElementById('videoTitle').value;
      const description = document.getElementById('videoDescription').value;

      if (!file || !title) {
        return alert('ファイルとタイトルは必須です');
      }

      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title);
      formData.append('description', description);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          closeUploadModal();
          location.reload();
        } else {
          alert('アップロード失敗');
        }
      } catch (e) {
        alert('エラー: ' + e.message);
      }
    }

    async function loadVideos() {
      try {
        const res = await fetch('/api/videos');
        const videos = await res.json();
        const grid = document.getElementById('videoGrid');
        
        grid.innerHTML = videos.map(v => \`
          <div class="video-card" onclick="playVideo('\${v.id}')">
            <div class="video-thumbnail">
              <video src="/uploads/videos/\${v.filename}" muted></video>
            </div>
            <div class="video-info">
              <div class="video-title">\${v.title}</div>
              <div class="video-meta">\${v.views || 0} 回視聴 • \${formatDate(v.uploadDate)}</div>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    function formatDate(d) {
      const date = new Date(d);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 60) return minutes + '分前';
      if (hours < 24) return hours + '時間前';
      if (days < 30) return days + '日前';
      return date.toLocaleDateString('ja-JP');
    }

    async function playVideo(id) {
      currentVideoId = id;

      try {
        const res = await fetch('/api/video/' + id);
        const video = await res.json();

        document.getElementById('playerVideo').src = '/uploads/videos/' + video.filename;
        document.getElementById('playerTitle').textContent = video.title;
        document.getElementById('viewCount').textContent = (video.views || 0) + ' 回視聴';
        document.getElementById('uploadDate').textContent = formatDate(video.uploadDate);
        document.getElementById('likeCount').textContent = video.likes || 0;
        document.getElementById('commentCount').textContent = (video.comments || []).length;

        updateLikeButton();
        loadComments(video.comments || []);

        document.getElementById('playerModal').classList.add('active');

        fetch('/api/video/' + id + '/view', { method: 'POST' });
      } catch (e) {
        alert('動画の読み込みエラー');
      }
    }

    function closePlayer() {
      document.getElementById('playerModal').classList.remove('active');
      document.getElementById('playerVideo').pause();
      currentVideoId = null;
    }

    async function toggleLike() {
      if (!currentVideoId) return;

      const liked = userLikes.has(currentVideoId);

      try {
        const res = await fetch('/api/video/' + currentVideoId + '/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ like: !liked })
        });

        const data = await res.json();
        document.getElementById('likeCount').textContent = data.likes;

        if (liked) {
          userLikes.delete(currentVideoId);
        } else {
          userLikes.add(currentVideoId);
        }

        updateLikeButton();
      } catch (e) {
        console.error(e);
      }
    }

    function updateLikeButton() {
      const btn = document.getElementById('likeBtn');
      if (userLikes.has(currentVideoId)) {
        btn.classList.add('liked');
      } else {
        btn.classList.remove('liked');
      }
    }

    async function postComment() {
      const text = document.getElementById('commentInput').value.trim();
      if (!text || !currentVideoId) return;

      try {
        const res = await fetch('/api/video/' + currentVideoId + '/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            author: 'ユーザー' + Math.floor(Math.random() * 1000)
          })
        });

        const data = await res.json();
        loadComments(data.comments);
        document.getElementById('commentInput').value = '';
        document.getElementById('commentCount').textContent = data.comments.length;
      } catch (e) {
        console.error(e);
      }
    }

    function loadComments(cmts) {
      const list = document.getElementById('commentsList');
      list.innerHTML = cmts.map(c => \`
        <div class="comment-item">
          <div class="comment-avatar">\${c.author[0]}</div>
          <div class="comment-content">
            <div class="comment-author">
              \${c.author}
              <span style="color:#aaa;font-weight:400;font-size:12px">
                \${formatDate(c.date)}
              </span>
            </div>
            <div class="comment-text">\${c.text}</div>
          </div>
        </div>
      \`).join('');
    }

    document.getElementById('searchInput').addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.video-card').forEach(card => {
        const title = card.querySelector('.video-title').textContent.toLowerCase();
        card.style.display = title.includes(query) ? 'block' : 'none';
      });
    });

    socket.on('newVideo', () => loadVideos());
    
    socket.on('videoUpdate', data => {
      if (data.id === currentVideoId) {
        if (data.views) {
          document.getElementById('viewCount').textContent = data.views + ' 回視聴';
        }
        if (data.likes !== undefined) {
          document.getElementById('likeCount').textContent = data.likes;
        }
      }
    });

    loadVideos();
  </script>
</body>
</html>`);
});

// API: 動画アップロード
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file' });
  }

  const video = {
    id: req.file.filename.split('.')[0],
    filename: req.file.filename,
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    uploadDate: new Date(),
    views: 0,
    likes: 0
  };

  videos.push(video);
  comments[video.id] = [];
  likes[video.id] = 0;
  views[video.id] = 0;

  io.emit('newVideo', video);
  res.json(video);
});

// API: 動画リスト取得
app.get('/api/videos', (req, res) => {
  res.json(videos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
});

// API: 動画詳細取得
app.get('/api/video/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  
  if (video) {
    res.json({
      ...video,
      comments: comments[video.id] || [],
      likes: likes[video.id] || 0,
      views: views[video.id] || 0
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// API: 視聴回数カウント
app.post('/api/video/:id/view', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  
  if (video) {
    views[req.params.id] = (views[req.params.id] || 0) + 1;
    video.views = views[req.params.id];
    
    io.emit('videoUpdate', {
      id: req.params.id,
      views: video.views
    });
    
    res.json({ views: video.views });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// API: いいね機能
app.post('/api/video/:id/like', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  
  if (video) {
    const delta = req.body.like ? 1 : -1;
    likes[req.params.id] = Math.max(0, (likes[req.params.id] || 0) + delta);
    video.likes = likes[req.params.id];
    
    io.emit('videoUpdate', {
      id: req.params.id,
      likes: video.likes
    });
    
    res.json({ likes: video.likes });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// API: コメント投稿
app.post('/api/video/:id/comment', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  
  if (video) {
    const comment = {
      id: crypto.randomBytes(8).toString('hex'),
      text: req.body.text,
      author: req.body.author || 'Anonymous',
      date: new Date()
    };
    
    if (!comments[req.params.id]) {
      comments[req.params.id] = [];
    }
    
    comments[req.params.id].unshift(comment);
    res.json({ comments: comments[req.params.id] });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Socket.io接続管理
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// サーバー起動
server.listen(PORT, () => {
  console.log(`🚀 VideoTube running on http://localhost:${PORT}`);
});
