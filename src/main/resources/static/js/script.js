
  /** 
   * CONFIGURATION 
   * Update this to your actual backend URL if different.
   * If serving from the same origin, relative path is fine.
   */
  const SERVER_URL = '/ws-chat'; 
  const RECONNECT_DELAY = 5000;

  // --- STATE ---
  let stompClient = null;
  let selectedUser = null; // null = Global Chat
  let currentUser = '';
  let allMessages = []; // Local history store
  let onlineUsers = [];
  let typingTimeouts = {}; // Map username -> timeout ID
  let isTyping = false;
  let typingTimeoutRef = null;

  // --- DOM ELEMENTS ---
  const chatContainer = document.getElementById('chat');
  const messageInput = document.getElementById('messageInput');
  const senderInput = document.getElementById('senderInput');
  const userListEl = document.getElementById('userList');
  const connDot = document.getElementById('connDot');
  const connText = document.getElementById('connText');
  const searchInput = document.getElementById('searchInput');
  const typingIndicator = document.getElementById('typingIndicator');
  const typingText = document.getElementById('typingText');
  const themeToggleBtn = document.getElementById('themeToggle');

  // --- INITIALIZATION ---
  window.onload = function() {
    // Restore name if saved
    const savedName = localStorage.getItem('talksy_username');
    if (savedName) {
      senderInput.value = savedName;
      currentUser = savedName;
    }
    
    // Restore Theme
    const savedTheme = localStorage.getItem('talksy_theme') || 'light';
    applyTheme(savedTheme);

    connect();
  };
  
  // --- THEME LOGIC ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
      icon.className = 'bi bi-sun-fill';
    } else {
      icon.className = 'bi bi-moon-fill';
    }
  }

  themeToggleBtn.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('talksy_theme', next);
  };

  // --- CONNECTION LOGIC ---
  function connect() {
    updateConnectionStatus('connecting');
    
    const socket = new SockJS(SERVER_URL);
    stompClient = Stomp.over(socket);
    
    // Disable debug logs for cleaner console
    stompClient.debug = () => {};

    stompClient.connect({}, function(frame) {
      updateConnectionStatus('online');
      
      // Subscribe to Public Topic
      stompClient.subscribe('/topic/messages', function(msg) {
        try {
          const body = JSON.parse(msg.body);
          handleIncomingMessage(body);
        } catch(e) { console.error(e); }
      });

      // Subscribe to User Updates
      stompClient.subscribe('/topic/users', function(msg) {
        try {
          const users = JSON.parse(msg.body);
          updateUserList(users);
        } catch(e) { console.error(e); }
      });

      // Announce Presence
      announceJoin();

    }, function(err) {
      console.error('STOMP error', err);
      updateConnectionStatus('offline');
      setTimeout(connect, RECONNECT_DELAY);
    });
  }

  function updateConnectionStatus(status) {
    connDot.className = 'status-dot ' + status;
    if (status === 'online') {
      connText.textContent = 'Online';
      connText.style.color = 'var(--text-muted)';
    } else if (status === 'connecting') {
      connText.textContent = 'Connecting...';
    } else {
      connText.textContent = 'Disconnected';
      connText.style.color = 'var(--status-offline)';
    }
  }

  function announceJoin() {
    currentUser = (senderInput.value || '').trim();
    if (currentUser && stompClient && stompClient.connected) {
      localStorage.setItem('talksy_username', currentUser);
      try {
        stompClient.send('/app/join', {}, JSON.stringify({ sender: currentUser }));
      } catch (e) { console.error(e); }
    }
  }

  // --- MESSAGING LOGIC ---
  function handleIncomingMessage(msg) {
    // Check for special types first
    if (msg.type === 'TYPING') {
      handleTypingEvent(msg.sender);
      return;
    }

    // Store message in history
    allMessages.push(msg);
    
    // If the message belongs to current view, render it
    // Logic: 
    // 1. Global View (selectedUser=null): Show messages with no 'to' field OR 'to' is null.
    // 2. Private View (selectedUser='Bob'): Show messages where (sender='Bob' AND to='Me') OR (sender='Me' AND to='Bob').
    
    const isPrivate = msg.to ? true : false;
    
    // Global Chat Logic
    if (selectedUser === null) {
      if (!isPrivate) {
        renderMessage(msg);
        scrollToBottom();
      }
    } 
    // Private Chat Logic
    else {
      // Is this message relevant to the currently open private chat?
      const relevant = (msg.sender === selectedUser && msg.to === currentUser) || 
                       (msg.sender === currentUser && msg.to === selectedUser);
      if (relevant) {
        renderMessage(msg);
        scrollToBottom();
      }
    }

    // Show notification/indicator if message is from someone else not currently selected
    if (isPrivate && msg.sender !== currentUser && msg.sender !== selectedUser) {
      showUnreadIndicator(msg.sender);
    }
  }

  function sendMessage() {
    if (!stompClient || !stompClient.connected) return;
    
    currentUser = (senderInput.value || '').trim();
    if (!currentUser) {
      alert('Please enter your name first');
      senderInput.focus();
      return;
    }

    const content = messageInput.value.trim();
    if (!content) return;

    // Construct Payload
    const msg = { 
      sender: currentUser, 
      content: content, 
      type: 'TEXT', 
      timestamp: new Date().toISOString()
    };

    // If in private chat, add 'to' field
    if (selectedUser) {
      msg.to = selectedUser;
    }

    try {
      stompClient.send('/app/sendMessage', {}, JSON.stringify(msg));
      messageInput.value = '';
      stopTyping(); // Clear typing status immediately
    } catch (e) { console.error('Send failed', e); }
  }

  function stopTyping() {
      // Logic to clear local typing state if we wanted to broadcast 'STOP_TYPING',
      // but for now we just let the timeout on other clients handle it.
      isTyping = false;
      clearTimeout(typingTimeoutRef);
  }

  function renderMessage(msg) {
    const isMe = (msg.sender === currentUser);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (isMe ? 'me' : 'others');

    // Content Rendering
    if (msg.type === 'FILE') {
      const lower = (msg.fileUrl || '').toLowerCase();
      if (/\.(png|jpg|jpeg|gif|webp)$/.test(lower)) {
        const img = document.createElement('img');
        img.src = msg.fileUrl;
        img.className = 'file-preview';
        bubble.appendChild(img);
        if(msg.content) {
            const txt = document.createElement('div');
            txt.textContent = msg.content;
            bubble.appendChild(txt);
        }
      } else {
        const icon = document.createElement('i');
        icon.className = 'bi bi-file-earmark-arrow-down-fill';
        const link = document.createElement('a');
        link.href = msg.fileUrl;
        link.target = '_blank';
        link.style.marginLeft = '6px';
        link.textContent = msg.content || 'Download File';
        bubble.appendChild(icon);
        bubble.appendChild(link);
      }
    } else {
      bubble.textContent = msg.content;
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    meta.textContent = isMe ? time : (msg.sender + ' • ' + time);
    
    bubble.appendChild(meta);
    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function switchChat(user) {
    selectedUser = user;
    
    // Update Sidebar UI
    const globalBtn = document.getElementById('globalChatBtn');
    const userItems = document.querySelectorAll('.user-item-wrapper');
    
    if (user === null) {
      globalBtn.classList.add('active');
      userItems.forEach(el => el.classList.remove('active'));
      document.getElementById('chatTitle').textContent = 'Global Chat';
      document.getElementById('chatSubtitle').textContent = 'Public channel';
      document.getElementById('headerAvatar').style.display = 'none';
    } else {
      globalBtn.classList.remove('active');
      userItems.forEach(el => {
        if(el.dataset.username === user) el.classList.add('active');
        else el.classList.remove('active');
      });
      // Clear unread
      const badge = document.getElementById('badge-' + user);
      if(badge) badge.style.display = 'none';

      document.getElementById('chatTitle').textContent = user;
      document.getElementById('chatSubtitle').textContent = 'Private Message';
      document.getElementById('headerAvatar').style.display = 'block';
      document.getElementById('headerAvatarImg').src = `https://ui-avatars.com/api/?background=random&name=${user}`;
    }

    // Mobile: Close drawer
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if(window.innerWidth < 768) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }

    // Repopulate Chat
    chatContainer.innerHTML = '';
    
    // Filter History
    allMessages.forEach(msg => {
        const isPrivate = msg.to ? true : false;
        
        if (selectedUser === null) {
            // Show global messages only
            if (!isPrivate) renderMessage(msg);
        } else {
            // Show private messages between me and selectedUser
            const relevant = (msg.sender === selectedUser && msg.to === currentUser) || 
                             (msg.sender === currentUser && msg.to === selectedUser);
            if (relevant) renderMessage(msg);
        }
    });
    
    scrollToBottom();
    messageInput.focus();
  }

  // --- TYPING INDICATOR LOGIC ---
  messageInput.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      sendTypingStatus();
    }
    clearTimeout(typingTimeoutRef);
    typingTimeoutRef = setTimeout(() => {
      isTyping = false;
    }, 2000);
  });

  function sendTypingStatus() {
    if(!currentUser || !stompClient) return;
    // Send a message with type TYPING
    const msg = { sender: currentUser, type: 'TYPING', content: '' };
    if(selectedUser) msg.to = selectedUser;
    try {
        stompClient.send('/app/sendMessage', {}, JSON.stringify(msg));
    } catch(e){}
  }

  function handleTypingEvent(sender) {
    if (sender === currentUser) return; // Ignore own typing

    // Only show if we are in the context of the sender
    if (selectedUser) {
        // In PM: Only show if the typing comes from the selected user
        if (sender !== selectedUser) return;
    }

    // UI Logic
    typingText.textContent = `${sender} is typing...`;
    typingIndicator.classList.add('active');
    
    // Clear existing timeout for this user
    if (typingTimeouts[sender]) clearTimeout(typingTimeouts[sender]);
    
    // Set removal timeout
    typingTimeouts[sender] = setTimeout(() => {
      typingIndicator.classList.remove('active');
    }, 3000);
  }

  // --- USER LIST LOGIC ---
  function updateUserList(users) {
    onlineUsers = users;
    renderUserListDOM();
  }

  function renderUserListDOM() {
    userListEl.innerHTML = '';
    const filter = searchInput.value.toLowerCase();
    
    const others = onlineUsers.filter(u => u !== currentUser);
    const visibleUsers = others.filter(u => u.toLowerCase().includes(filter));

    if (visibleUsers.length === 0) {
      document.getElementById('noUsersMsg').style.display = 'block';
    } else {
      document.getElementById('noUsersMsg').style.display = 'none';
      visibleUsers.forEach(u => {
        const li = document.createElement('li');
        li.className = 'nav-item user-item-wrapper';
        li.dataset.username = u;
        if(selectedUser === u) li.classList.add('active');
        
        li.onclick = () => switchChat(u);

        li.innerHTML = `
          <div class="avatar-wrapper">
            <img src="https://ui-avatars.com/api/?background=random&name=${u}" alt="${u}">
            <div class="status-indicator"></div>
          </div>
          <div class="name">${u}</div>
          <div id="badge-${u}" style="display:none; width:8px; height:8px; background:var(--primary); border-radius:50%;"></div>
        `;
        userListEl.appendChild(li);
      });
    }
  }

  function showUnreadIndicator(sender) {
    const badge = document.getElementById('badge-' + sender);
    if(badge) badge.style.display = 'block';
  }

  searchInput.addEventListener('input', renderUserListDOM);

  // --- NAME CHANGE HANDLING ---
  senderInput.addEventListener('blur', announceJoin);
  senderInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') { 
      e.preventDefault(); 
      announceJoin(); 
    }
  });

  // --- SEND BUTTONS ---
  document.getElementById('sendMessage').onclick = sendMessage;
  messageInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });

  // --- FILE UPLOAD ---
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');
  const attachedFileName = document.getElementById('attachedFileName');
  const filePreview = document.getElementById('filePreview');
  let attachedFile = null;

  attachBtn.onclick = () => fileInput.click();
  
  fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if(!f) return;
    attachedFile = f;
    attachedFileName.textContent = f.name;
    
    if(f.type.startsWith('image/')) {
        filePreview.src = URL.createObjectURL(f);
        filePreview.style.display = 'block';
    } else {
        filePreview.style.display = 'none';
    }
    uploadFile();
  };

function uploadFile() {
  if (!attachedFile || !stompClient) return;

  // Ensure currentUser is set
  currentUser = (senderInput.value || '').trim();
  if (!currentUser) {
    alert('Please enter your name first');
    senderInput.focus();
    return;
  }

  // Visual feedback
  attachedFileName.textContent = 'Uploading ' + attachedFile.name + '...';

  const formData = new FormData();
  formData.append('file', attachedFile);
  formData.append('sender', currentUser);

  // ✅ If in private chat, tell backend who the recipient is
  if (selectedUser) {
    formData.append('to', selectedUser);
  }

  fetch('/upload', { method: 'POST', body: formData })
    .then(res => {
      if (!res.ok) throw new Error('Error');
      return res.json();
    })
    .then(data => {
      attachedFile = null;
      attachedFileName.textContent = '';
      filePreview.style.display = 'none';
      // No need to manually render: WebSocket broadcast will call handleIncomingMessage()
    })
    .catch(err => {
      console.error(err);
      attachedFileName.textContent = 'Upload Failed';
    });
}


  // --- EMOJI ---
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPopover = document.getElementById('emojiPopover');
  
  emojiBtn.onclick = (e) => {
    e.stopPropagation();
    emojiPopover.classList.toggle('open');
  };

  document.querySelectorAll('.emoji').forEach(e => {
    e.onclick = () => {
      messageInput.value += e.textContent;
      messageInput.focus();
    };
  });

  document.addEventListener('click', (e) => {
    if (!emojiPopover.contains(e.target) && !emojiBtn.contains(e.target)) {
      emojiPopover.classList.remove('open');
    }
  });

  // --- MOBILE DRAWER ---
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');

  menuBtn.onclick = () => {
    sidebar.classList.add('active');
    overlay.classList.add('active');
  };
  
  overlay.onclick = () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  };


