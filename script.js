// رمزنگاری اطلاعات حساس با Base64
const _0x1a2b = {
    _0x3c4d: btoa('09904844031'),
    _0x5e6f: btoa('Par1617230'),
    _0x7g8h: btoa('$2a$10$uiXT7AaQXL1B8YWEXfMo4ueoSKHj4/s9MUmSee6WuTD55wmjG3QMC'),
    _0x9i0j: btoa('6a6f9a1bda38895dfeb099fd')
};

const ADMIN_PHONE = atob(_0x1a2b._0x3c4d);
const ADMIN_PASS = atob(_0x1a2b._0x5e6f);
const JSONBIN_MASTER_KEY = atob(_0x1a2b._0x7g8h);
const JSONBIN_BIN_ID = atob(_0x1a2b._0x9i0j);
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// موجودی اولیه پنل مدیریت (۵ میلیون تومان)
const INITIAL_ADMIN_WALLET = 5000000;

let tempUserData = {};
let generatedOTP = "";
let currentAdminChatPhone = null;
let banTargetPhone = null;
let walletTargetPhone = null;
let adminRefreshInterval = null;

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

function getUsers() { 
    try { 
        const data = localStorage.getItem('an_users');
        return data ? JSON.parse(data) : []; 
    } catch(e) { return []; }
}
function saveUsers(users) { localStorage.setItem('an_users', JSON.stringify(users)); }
function getCurrentUser() { 
    try { 
        const data = localStorage.getItem('an_current_user');
        return data ? JSON.parse(data) : null; 
    } catch(e) { return null; }
}
function setCurrentUser(user) { localStorage.setItem('an_current_user', JSON.stringify(user)); }
function clearCurrentUser() { localStorage.removeItem('an_current_user'); }

function getAdminProfile() {
    try {
        const data = localStorage.getItem('an_admin_profile');
        return data ? JSON.parse(data) : null;
    } catch(e) { return null; }
}
function saveAdminProfile(profile) {
    localStorage.setItem('an_admin_profile', JSON.stringify(profile));
}

// به‌روزرسانی نمایش موجودی پنل در بالای پنل مدیریت
function updateAdminWalletDisplay() {
    const adminProfile = getAdminProfile();
    const balanceEl = document.getElementById('adminWalletBalance');
    if (balanceEl && adminProfile) {
        balanceEl.textContent = (adminProfile.wallet || 0).toLocaleString('fa-IR') + ' تومان';
    }
}

async function getMessages() { 
    try { 
        const res = await fetch(JSONBIN_URL, {
            headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
        });
        const data = await res.json();
        return data.record?.messages || [];
    } catch(e) { 
        console.error('خطا در دریافت پیام‌ها:', e);
        return []; 
    }
}

async function saveMessages(msgs) { 
    try {
        const currentData = await fetch(JSONBIN_URL, {
            headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
        }).then(r => r.json());
        
        const updatedData = {
            ...currentData.record,
            messages: msgs
        };
        
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY 
            },
            body: JSON.stringify(updatedData)
        });
    } catch(e) { 
        console.error('خطا در ذخیره پیام‌ها:', e);
        showToast('خطا در ذخیره پیام', 'error');
    }
}

async function getBans() {
    try {
        const res = await fetch(JSONBIN_URL, {
            headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
        });
        const data = await res.json();
        return data.record?.bans || [];
    } catch(e) { 
        console.error('خطا در دریافت بن‌ها:', e);
        return []; 
    }
}

async function saveBans(bans) {
    try {
        const currentData = await fetch(JSONBIN_URL, {
            headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
        }).then(r => r.json());
        
        const updatedData = {
            ...currentData.record,
            bans: bans
        };
        
        await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_MASTER_KEY 
            },
            body: JSON.stringify(updatedData)
        });
    } catch(e) { 
        console.error('خطا در ذخیره بن‌ها:', e);
    }
}

async function isUserBanned(phone) {
    const bans = await getBans();
    const ban = bans.find(b => b.phone === phone);
    if (!ban) return false;
    
    if (ban.duration === 'permanent') return true;
    
    const banTime = new Date(ban.timestamp).getTime();
    const durationMs = ban.duration * 60 * 60 * 1000;
    const now = Date.now();
    
    if (now - banTime > durationMs) {
        const updatedBans = bans.filter(b => b.phone !== phone);
        await saveBans(updatedBans);
        return false;
    }
    
    return true;
}

window.addEventListener('load', () => {
    const loaderFill = document.getElementById('loaderFill');
    const loaderVideo = document.getElementById('loaderVideo');
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += (100 / 70);
        if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
        }
        loaderFill.style.width = progress + '%';
    }, 100);
    
    if (loaderVideo) {
        loaderVideo.play().catch(() => {
            document.addEventListener('click', () => loaderVideo.play(), { once: true });
        });
    }
    
    setTimeout(() => {
        document.getElementById('loader').classList.add('hide');
        if (loaderVideo) loaderVideo.pause();
        
        const v = document.getElementById('mainVideo');
        if (v) v.play().catch(() => document.addEventListener('click', () => v.play(), { once: true }));
        
        updateUI();
    }, 7000);
});

const slides = document.querySelectorAll('.slide');
let cur = 0;
setInterval(() => {
    slides[cur].classList.remove('on');
    cur = (cur + 1) % slides.length;
    slides[cur].classList.add('on');
}, 3000);

function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
document.addEventListener('click', e => {
    const m = document.getElementById('sidebar');
    const b = document.querySelector('.menu-btn');
    if (!m.contains(e.target) && !b.contains(e.target) && m.classList.contains('open')) m.classList.remove('open');
});

let tempAvatar = '';
function previewAvatar(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        tempAvatar = ev.target.result;
        document.getElementById('avatarPreview').innerHTML = `<img src="${tempAvatar}">`;
    };
    r.readAsDataURL(f);
}

function requestOTP() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value.trim();

    if (!name || !phone || !password) return showToast('لطفاً تمام فیلدها را پر کنید', 'error');
    if (!/^09\d{9}$/.test(phone)) return showToast('شماره موبایل نامعتبر است', 'error');
    if (password.length < 6) return showToast('رمز عبور باید حداقل ۶ کاراکتر باشد', 'error');

    const users = getUsers();
    if (users.find(u => u.phone === phone)) return showToast('این شماره قبلاً ثبت‌نام کرده است', 'error');

    generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    document.getElementById('otpCodeDisplay').textContent = generatedOTP;
    document.getElementById('otpInput').value = '';
    
    tempUserData = { 
        name: name, 
        phone: phone, 
        password: simpleHash(password),
        isAdmin: (phone === ADMIN_PHONE && simpleHash(password) === simpleHash(ADMIN_PASS)),
        avatar: tempAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`,
        wallet: 0,
        joinDate: new Date().toLocaleDateString('fa-IR')
    };
    
    closeModal('registerModal');
    openModal('otpModal');
    showToast('کد تایید نمایش داده شد، آن را وارد کنید', 'info');
}

function verifyOTP() {
    const inputOTP = document.getElementById('otpInput').value.trim();
    if (inputOTP !== generatedOTP) return showToast('کد تایید اشتباه است', 'error');

    const users = getUsers();
    const newUser = { ...tempUserData, id: Date.now() };
    users.push(newUser);
    saveUsers(users);
    
    setCurrentUser(newUser);
    closeModal('otpModal');
    
    tempAvatar = '';
    tempUserData = {};
    
    showToast('ثبت‌نام با موفقیت انجام شد! خوش آمدید ' + newUser.name, 'success');
    
    setTimeout(() => {
        updateUI();
        document.getElementById('sidebar').classList.add('open');
        
        if (newUser.isAdmin) {
            setTimeout(() => {
                openAdminPanel();
            }, 1500);
        }
    }, 300);
}

function handleLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!phone || !password) return showToast('لطفاً شماره و رمز عبور را وارد کنید', 'error');

    if (phone === ADMIN_PHONE && simpleHash(password) === simpleHash(ADMIN_PASS)) {
        let adminProfile = getAdminProfile();
        if (!adminProfile) {
            // ساخت پروفایل مدیر با موجودی اولیه ۵ میلیون تومان
            adminProfile = {
                id: 1,
                name: 'مدیر سیستم',
                phone: ADMIN_PHONE,
                password: simpleHash(ADMIN_PASS),
                isAdmin: true,
                avatar: 'https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff',
                wallet: INITIAL_ADMIN_WALLET,
                joinDate: new Date().toLocaleDateString('fa-IR')
            };
            saveAdminProfile(adminProfile);
            showToast('پروفایل مدیر ساخته شد با موجودی ۵,۰۰۰,۰۰۰ تومان', 'success');
        }
        setCurrentUser(adminProfile);
        closeModal('loginModal');
        showToast('خوش آمدید مدیر عزیز', 'success');
        updateUI();
        setTimeout(openAdminPanel, 500);
        return;
    }

    const users = getUsers();
    const user = users.find(u => u.phone === phone && u.password === simpleHash(password));

    if (user) {
        setCurrentUser(user);
        closeModal('loginModal');
        showToast('خوش آمدید ' + user.name, 'success');
        updateUI();
        if (user.isAdmin) setTimeout(openAdminPanel, 500);
    } else {
        showToast('شماره موبایل یا رمز عبور اشتباه است', 'error');
    }
}

function handleForgot() {
    const phone = document.getElementById('forgotPhone').value.trim();
    if (!phone) return showToast('لطفاً شماره موبایل را وارد کنید', 'error');

    if (phone === ADMIN_PHONE) {
        showToast('رمز عبور مدیر: ' + ADMIN_PASS, 'info');
        closeModal('forgotModal');
        return;
    }

    const users = getUsers();
    const user = users.find(u => u.phone === phone);

    if (user) {
        showToast('رمز عبور شما: ' + user.password, 'info');
        closeModal('forgotModal');
    } else {
        showToast('این شماره ثبت‌نام نشده است', 'error');
    }
}

function handleLogout() {
    clearCurrentUser();
    closeSettingsPage();
    toggleMenu();
    showToast('با موفقیت خارج شدید', 'info');
    updateUI();
}

function openSettingsPage() {
    const user = getCurrentUser();
    if (!user) return showToast('لطفاً ابتدا وارد شوید', 'error');
    
    document.getElementById('settingsAvatar').src = user.avatar;
    document.getElementById('settingsName').value = user.name;
    document.getElementById('settingsPhone').value = user.phone;
    document.getElementById('settingsJoinDate').value = user.joinDate || 'نامشخص';
    document.getElementById('walletAmount').textContent = (user.wallet || 0).toLocaleString('fa-IR') + ' تومان';
    
    document.getElementById('settingsPage').classList.add('on');
}

function closeSettingsPage() {
    document.getElementById('settingsPage').classList.remove('on');
}

function changeAvatar(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        const newAvatar = ev.target.result;
        const user = getCurrentUser();
        
        if (user.isAdmin) {
            let adminProfile = getAdminProfile();
            if (adminProfile) {
                adminProfile.avatar = newAvatar;
                saveAdminProfile(adminProfile);
                user.avatar = newAvatar;
                setCurrentUser(user);
            }
        } else {
            const users = getUsers();
            const idx = users.findIndex(u => u.phone === user.phone);
            if (idx !== -1) {
                users[idx].avatar = newAvatar;
                saveUsers(users);
                user.avatar = newAvatar;
                setCurrentUser(user);
            }
        }
        
        document.getElementById('settingsAvatar').src = newAvatar;
        updateUI();
        showToast('عکس پروفایل با موفقیت تغییر کرد', 'success');
    };
    r.readAsDataURL(f);
}

function changeName() {
    const newName = document.getElementById('settingsName').value.trim();
    if (!newName) return showToast('نام نمی‌تواند خالی باشد', 'error');

    const user = getCurrentUser();
    
    if (user.isAdmin) {
        let adminProfile = getAdminProfile();
        if (adminProfile) {
            adminProfile.name = newName;
            adminProfile.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=ef4444&color=fff`;
            saveAdminProfile(adminProfile);
            user.name = newName;
            user.avatar = adminProfile.avatar;
            setCurrentUser(user);
        }
    } else {
        const users = getUsers();
        const idx = users.findIndex(u => u.phone === user.phone);
        if (idx !== -1) {
            users[idx].name = newName;
            users[idx].avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=3b82f6&color=fff`;
            saveUsers(users);
            user.name = newName;
            user.avatar = users[idx].avatar;
            setCurrentUser(user);
        }
    }
    
    document.getElementById('settingsAvatar').src = user.avatar;
    document.getElementById('settingsName').value = user.name;
    updateUI();
    showToast('نام با موفقیت تغییر کرد', 'success');
}

function changePassword() {
    const currentPass = document.getElementById('currentPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();

    if (!currentPass || !newPass || !confirmPass) return showToast('لطفاً تمام فیلدها را پر کنید', 'error');
    if (newPass.length < 6) return showToast('رمز عبور جدید باید حداقل ۶ کاراکتر باشد', 'error');
    if (newPass !== confirmPass) return showToast('رمز عبور جدید و تکرار آن مطابقت ندارند', 'error');

    const user = getCurrentUser();
    if (user.password !== simpleHash(currentPass)) return showToast('رمز عبور فعلی اشتباه است', 'error');

    if (user.isAdmin) {
        let adminProfile = getAdminProfile();
        if (adminProfile) {
            adminProfile.password = simpleHash(newPass);
            saveAdminProfile(adminProfile);
            user.password = simpleHash(newPass);
            setCurrentUser(user);
        }
    } else {
        const users = getUsers();
        const idx = users.findIndex(u => u.phone === user.phone);
        if (idx !== -1) {
            users[idx].password = simpleHash(newPass);
            saveUsers(users);
            user.password = simpleHash(newPass);
            setCurrentUser(user);
        }
    }
    
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    
    showToast('رمز عبور با موفقیت تغییر کرد', 'success');
}

function updateUI() {
    const user = getCurrentUser();
    const sidebarProfile = document.getElementById('sidebarProfile');
    const sidebarLogout = document.getElementById('sidebarLogout');
    const menuLogin = document.getElementById('menuLogin');
    const menuSettings = document.getElementById('menuSettings');
    const menuAdmin = document.getElementById('menuAdmin');

    if (user) {
        document.getElementById('sidebarAvatar').src = user.avatar;
        document.getElementById('sidebarName').textContent = user.name;
        document.getElementById('sidebarPhone').textContent = user.phone;
        
        sidebarProfile.classList.add('visible');
        sidebarLogout.classList.add('visible');
        menuLogin.classList.remove('visible');
        menuSettings.classList.add('visible');
        
        if (user.isAdmin) menuAdmin.classList.add('visible');
        else menuAdmin.classList.remove('visible');
    } else {
        sidebarProfile.classList.remove('visible');
        sidebarLogout.classList.remove('visible');
        menuLogin.classList.add('visible');
        menuSettings.classList.remove('visible');
        menuAdmin.classList.remove('visible');
    }
}

function showMember(id) {
    const members = {
        matin: { name: 'متین', role: 'نویسنده و توسعه‌دهنده', desc: 'متین، نویسنده و توسعه‌دهنده اصلی مجموعه آینده نگر است.', img: '4.jpg' },
        abolfazl: { name: 'ابوالفضل بشارت', role: 'عضو تیم', desc: 'ابوالفضل بشارت یکی از اعضای کلیدی تیم است.', img: '30.jpg' },
        amirhossein: { name: 'امیرحسین شکری زاده', role: 'عضو تیم', desc: 'امیرحسین شکری زاده با ایده‌های نوآورانه به رشد مجموعه کمک می‌کند.', img: '5.jpg' }
    };
    const m = members[id];
    if (m) {
        document.getElementById('teamModalImg').src = m.img;
        document.getElementById('teamModalName').textContent = m.name;
        document.getElementById('teamModalRole').textContent = m.role;
        document.getElementById('teamModalDesc').textContent = m.desc;
        openModal('teamModal');
    }
}

async function handleChatClick() {
    const user = getCurrentUser();
    if (!user) {
        showToast('برای استفاده از چت، لطفاً ابتدا وارد حساب کاربری خود شوید', 'error');
        openModal('loginModal');
        return;
    }
    
    const banned = await isUserBanned(user.phone);
    if (banned) {
        showToast('⛔ حساب شما از چت محروم شده است. با پشتیبانی تماس بگیرید.', 'error');
        return;
    }
    
    toggleChatBox();
    await loadUserChat(user.phone);
}

function toggleChatBox() { document.getElementById('chatBox').classList.toggle('on'); }

async function loadUserChat(phone) {
    const msgs = await getMessages();
    const userMsgs = msgs.filter(m => m.userPhone === phone || m.isBroadcast).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const container = document.getElementById('chatMsgs');
    container.innerHTML = '';

    if (userMsgs.length === 0) {
        container.innerHTML = `<div class="msg admin">سلام! چطور می‌توانم کمکتان کنم؟<span class="time">سیستم</span></div>`;
    } else {
        userMsgs.forEach(m => {
            const div = document.createElement('div');
            if (m.isBroadcast) {
                div.className = 'msg system-broadcast';
                div.innerHTML = `📢 <strong>${m.broadcastTitle || 'اطلاعیه'}</strong><br>${m.text}<span class="time">${m.time}</span>`;
            } else if (m.sender === 'user') {
                div.className = 'msg user';
                div.innerHTML = `${m.text}<span class="time">${m.time}</span>`;
            } else {
                div.className = 'msg admin';
                div.innerHTML = `${m.text}<span class="time">${m.time}</span>`;
            }
            container.appendChild(div);
        });
    }
    container.scrollTop = container.scrollHeight;
}

async function sendUserMsg() {
    const user = getCurrentUser();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !user) return;

    const banned = await isUserBanned(user.phone);
    if (banned) {
        showToast('⛔ حساب شما از چت محروم شده است', 'error');
        return;
    }

    const msgs = await getMessages();
    const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
    
    msgs.push({
        id: Date.now(),
        userPhone: user.phone,
        userName: user.name,
        userAvatar: user.avatar,
        sender: 'user',
        text: text,
        time: time,
        timestamp: new Date().toISOString(),
        read: false
    });
    
    await saveMessages(msgs);
    input.value = '';
    await loadUserChat(user.phone);
    showToast('پیام ارسال شد', 'success');
}

function openAdminPanel() {
    const user = getCurrentUser();
    if (!user || !user.isAdmin) return showToast('دسترسی غیرمجاز', 'error');
    document.getElementById('adminPanel').classList.add('on');
    updateAdminWalletDisplay();
    loadAdminData();
    
    if (adminRefreshInterval) clearInterval(adminRefreshInterval);
    adminRefreshInterval = setInterval(() => {
        if (document.getElementById('adminPanel').classList.contains('on')) {
            updateAdminWalletDisplay();
            const activeTab = document.querySelector('.admin-tab.on');
            if (activeTab && activeTab.textContent.includes('کاربران')) {
                loadAdminData();
            } else if (activeTab && activeTab.textContent.includes('گفتگوها')) {
                loadAdminChats();
            }
        }
    }, 5000);
}

function closeAdminPanel() { 
    document.getElementById('adminPanel').classList.remove('on');
    if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
    }
}

function switchAdminTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('adminUsersTab').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('adminChatsTab').style.display = tab === 'chats' ? 'block' : 'none';
    document.getElementById('adminBroadcastTab').style.display = tab === 'broadcast' ? 'block' : 'none';
    if (tab === 'chats') loadAdminChats();
    if (tab === 'users') loadAdminData();
}

async function loadAdminData() {
    const users = getUsers();
    const bans = await getBans();
    const list = document.getElementById('adminUserList');
    list.innerHTML = '';
    
    const adminProfile = getAdminProfile();
    if (adminProfile) {
        list.innerHTML += `
            <div class="user-list-item" style="background:#f0fdf4;border:1px solid #10b981;border-radius:10px">
                <img src="${adminProfile.avatar}" alt="${adminProfile.name}">
                <div class="user-list-item-info">
                    <h4>${adminProfile.name} <span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-right:5px">مدیر</span></h4>
                    <p>${adminProfile.phone} | موجودی: ${(adminProfile.wallet || 0).toLocaleString('fa-IR')} تومان</p>
                </div>
            </div>`;
    }
    
    users.forEach(u => {
        if (u.phone !== ADMIN_PHONE) {
            const isBanned = bans.find(b => b.phone === u.phone);
            const bannedBadge = isBanned ? `<span class="banned-badge">بن</span>` : '';
            const walletBadge = `<span class="wallet-badge">${(u.wallet || 0).toLocaleString('fa-IR')} ت</span>`;
            list.innerHTML += `
                <div class="user-list-item">
                    <img src="${u.avatar}" alt="${u.name}">
                    <div class="user-list-item-info">
                        <h4>${u.name} ${bannedBadge} ${walletBadge}</h4>
                        <p>${u.phone}</p>
                    </div>
                    <div class="user-actions">
                        <button class="btn-small btn-wallet" onclick="openWalletModal('${u.phone}', '${u.name}', ${u.wallet || 0})">💰 شارژ</button>
                        ${isBanned 
                            ? `<button class="btn-small btn-unban" onclick="unbanUser('${u.phone}')">رفع بن</button>` 
                            : `<button class="btn-small btn-ban" onclick="openBanModal('${u.phone}', '${u.name}')">بن</button>`
                        }
                    </div>
                </div>`;
        }
    });
}

function openBanModal(phone, name) {
    banTargetPhone = phone;
    document.getElementById('banUserName').textContent = name;
    document.getElementById('banDuration').value = '24';
    document.getElementById('banReason').value = '';
    openModal('banModal');
}

async function confirmBan() {
    if (!banTargetPhone) return;
    
    const duration = document.getElementById('banDuration').value;
    const reason = document.getElementById('banReason').value.trim();
    
    const bans = await getBans();
    const filteredBans = bans.filter(b => b.phone !== banTargetPhone);
    
    filteredBans.push({
        phone: banTargetPhone,
        duration: duration,
        reason: reason || 'بدون دلیل',
        timestamp: new Date().toISOString()
    });
    
    await saveBans(filteredBans);
    closeModal('banModal');
    showToast('کاربر با موفقیت محروم شد', 'success');
    loadAdminData();
}

async function unbanUser(phone) {
    const bans = await getBans();
    const updatedBans = bans.filter(b => b.phone !== phone);
    await saveBans(updatedBans);
    showToast('محرومیت کاربر برطرف شد', 'success');
    loadAdminData();
}

// باز کردن مودال شارژ کیف پول کاربر
function openWalletModal(phone, name, currentBalance) {
    walletTargetPhone = phone;
    const adminProfile = getAdminProfile();
    const adminBalance = adminProfile ? (adminProfile.wallet || 0) : 0;
    
    document.getElementById('walletUserName').textContent = name;
    document.getElementById('walletCurrentBalance').textContent = currentBalance.toLocaleString('fa-IR');
    document.getElementById('walletPanelBalance').textContent = adminBalance.toLocaleString('fa-IR');
    document.getElementById('walletAmountInput').value = '';
    document.getElementById('walletDescription').value = '';
    openModal('walletModal');
}

// تایید شارژ کیف پول کاربر (با کسر از موجودی پنل)
async function confirmWalletAdd() {
    if (!walletTargetPhone) return;
    
    const amount = parseInt(document.getElementById('walletAmountInput').value);
    const description = document.getElementById('walletDescription').value.trim();
    
    if (!amount || amount <= 0) return showToast('لطفاً مبلغ معتبر وارد کنید', 'error');
    
    // گرفتن موجودی پنل
    const adminProfile = getAdminProfile();
    const adminBalance = adminProfile ? (adminProfile.wallet || 0) : 0;
    
    // بررسی موجودی پنل
    if (adminBalance < amount) {
        showToast(`❌ موجودی پنل کافی نیست! موجودی فعلی: ${adminBalance.toLocaleString('fa-IR')} تومان`, 'error');
        return;
    }
    
    // کسر از موجودی پنل
    adminProfile.wallet = adminBalance - amount;
    saveAdminProfile(adminProfile);
    
    // اضافه کردن به کیف پول کاربر
    const users = getUsers();
    const idx = users.findIndex(u => u.phone === walletTargetPhone);
    
    if (idx !== -1) {
        users[idx].wallet = (users[idx].wallet || 0) + amount;
        saveUsers(users);
        
        // به‌روزرسانی کاربر فعلی اگر همین کاربر است
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.phone === walletTargetPhone) {
            currentUser.wallet = users[idx].wallet;
            setCurrentUser(currentUser);
        }
        
        closeModal('walletModal');
        showToast(`✅ ${amount.toLocaleString('fa-IR')} تومان به کیف پول ${users[idx].name} شارژ شد`, 'success');
        
        // به‌روزرسانی نمایش موجودی پنل
        updateAdminWalletDisplay();
        loadAdminData();
    } else {
        showToast('کاربر پیدا نشد', 'error');
    }
}

// باز کردن مودال افزایش موجودی پنل
function openAdminWalletAddModal() {
    const adminProfile = getAdminProfile();
    const currentBalance = adminProfile ? (adminProfile.wallet || 0) : 0;
    document.getElementById('adminCurrentWallet').textContent = currentBalance.toLocaleString('fa-IR');
    document.getElementById('adminWalletAddAmount').value = '';
    document.getElementById('adminWalletAddDesc').value = '';
    openModal('adminWalletAddModal');
}

// تایید افزایش موجودی پنل
function confirmAdminWalletAdd() {
    const amount = parseInt(document.getElementById('adminWalletAddAmount').value);
    const description = document.getElementById('adminWalletAddDesc').value.trim();
    
    if (!amount || amount <= 0) return showToast('لطفاً مبلغ معتبر وارد کنید', 'error');
    
    const adminProfile = getAdminProfile();
    if (!adminProfile) return showToast('پروفایل مدیر پیدا نشد', 'error');
    
    adminProfile.wallet = (adminProfile.wallet || 0) + amount;
    saveAdminProfile(adminProfile);
    
    // به‌روزرسانی کاربر فعلی
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.isAdmin) {
        currentUser.wallet = adminProfile.wallet;
        setCurrentUser(currentUser);
    }
    
    closeModal('adminWalletAddModal');
    updateAdminWalletDisplay();
    showToast(`✅ ${amount.toLocaleString('fa-IR')} تومان به کیف پول پنل اضافه شد`, 'success');
}

async function loadAdminChats() {
    const msgs = await getMessages();
    const list = document.getElementById('adminChatList');
    list.innerHTML = '';
    
    const userChats = {};
    msgs.forEach(m => {
        if (m.sender !== 'broadcast' && !userChats[m.userPhone]) {
            userChats[m.userPhone] = { 
                name: m.userName, 
                avatar: m.userAvatar || 'https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff',
                lastMsg: m.text,
                time: m.time,
                unread: 0
            };
        }
        if (m.sender === 'user' && !m.read) {
            if (userChats[m.userPhone]) {
                userChats[m.userPhone].unread++;
            }
        }
    });
    
    const phones = Object.keys(userChats);
    if (phones.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px">هنوز گفتگویی وجود ندارد</p>';
        return;
    }
    
    phones.forEach(phone => {
        const u = userChats[phone];
        const unreadBadge = u.unread > 0 ? `<span class="unread-badge">${u.unread}</span>` : '';
        list.innerHTML += `
            <div class="user-list-item" onclick="openAdminChatPage('${phone}')">
                <img src="${u.avatar}" alt="${u.name}">
                <div class="user-list-item-info">
                    <h4>${u.name} ${unreadBadge}</h4>
                    <p>${u.lastMsg.substring(0, 40)}${u.lastMsg.length > 40 ? '...' : ''}</p>
                </div>
            </div>`;
    });
}

async function openAdminChatPage(phone) {
    currentAdminChatPhone = phone;
    const msgs = await getMessages();
    const userMsg = msgs.find(m => m.userPhone === phone && m.sender !== 'broadcast');
    const userName = userMsg ? userMsg.userName : 'کاربر';
    const userAvatar = userMsg && userMsg.userAvatar ? userMsg.userAvatar : 'https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff';
    
    document.getElementById('adminChatUserName').textContent = userName;
    document.getElementById('adminChatUserPhone').textContent = phone;
    document.getElementById('adminChatUserAvatar').src = userAvatar;
    
    msgs.forEach(m => {
        if (m.userPhone === phone && m.sender === 'user') {
            m.read = true;
        }
    });
    await saveMessages(msgs);
    
    loadAdminChatMsgs();
    document.getElementById('adminChatPage').classList.add('on');
}

function closeAdminChatPage() {
    document.getElementById('adminChatPage').classList.remove('on');
    currentAdminChatPhone = null;
}

async function loadAdminChatMsgs() {
    if (!currentAdminChatPhone) return;
    const msgs = await getMessages();
    const chatMsgs = msgs.filter(m => m.userPhone === currentAdminChatPhone).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const container = document.getElementById('adminChatMsgs');
    container.innerHTML = '';
    
    if (chatMsgs.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px">هنوز پیامی ارسال نشده است</p>';
        return;
    }
    
    chatMsgs.forEach(m => {
        const div = document.createElement('div');
        if (m.isBroadcast) {
            div.className = 'msg system-broadcast';
            div.innerHTML = ` <strong>${m.broadcastTitle || 'اطلاعیه'}</strong><br>${m.text}<span class="time">${m.time}</span>`;
        } else if (m.sender === 'user') {
            div.className = 'msg user';
            div.innerHTML = `${m.text}<span class="time">${m.time}</span>`;
        } else {
            div.className = 'msg admin';
            div.innerHTML = `${m.text}<span class="time">${m.time}</span>`;
        }
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function sendAdminChatMsg() {
    if (!currentAdminChatPhone) return showToast('ابتدا یک گفتگو را انتخاب کنید', 'error');
    const input = document.getElementById('adminChatInput');
    const text = input.value.trim();
    if (!text) return;

    const msgs = await getMessages();
    const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
    const currentUser = getCurrentUser();
    
    msgs.push({
        id: Date.now(),
        userPhone: currentAdminChatPhone,
        userName: currentUser ? currentUser.name : 'مدیر',
        userAvatar: currentUser ? currentUser.avatar : '',
        sender: 'admin',
        text: text,
        time: time,
        timestamp: new Date().toISOString(),
        read: true
    });
    await saveMessages(msgs);
    input.value = '';
    loadAdminChatMsgs();
}

async function sendBroadcast() {
    const title = document.getElementById('broadcastTitle').value.trim();
    const message = document.getElementById('broadcastMessage').value.trim();
    const resultDiv = document.getElementById('broadcastResult');
    
    if (!message) return showToast('لطفاً متن پیام را وارد کنید', 'error');
    
    const users = getUsers();
    const regularUsers = users.filter(u => u.phone !== ADMIN_PHONE);
    
    if (regularUsers.length === 0) {
        resultDiv.innerHTML = '<div class="broadcast-success" style="background:#f59e0b">⚠️ هیچ کاربر عادی برای ارسال پیام وجود ندارد</div>';
        return;
    }
    
    const msgs = await getMessages();
    const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
    const currentUser = getCurrentUser();
    
    regularUsers.forEach(user => {
        msgs.push({
            id: Date.now() + Math.random(),
            userPhone: user.phone,
            userName: currentUser ? currentUser.name : 'مدیر',
            userAvatar: currentUser ? currentUser.avatar : '',
            sender: 'broadcast',
            isBroadcast: true,
            broadcastTitle: title || 'اطلاعیه سیستم',
            text: message,
            time: time,
            timestamp: new Date().toISOString(),
            read: false
        });
    });
    
    await saveMessages(msgs);
    
    resultDiv.innerHTML = `<div class="broadcast-success">✅ پیام با موفقیت به ${regularUsers.length} کاربر ارسال شد</div>`;
    document.getElementById('broadcastTitle').value = '';
    document.getElementById('broadcastMessage').value = '';
    
    showToast(`پیام به ${regularUsers.length} کاربر ارسال شد`, 'success');
    
    setTimeout(() => {
        resultDiv.innerHTML = '';
    }, 5000);
}

function openModal(id) { document.getElementById(id).classList.add('on'); }
function closeModal(id) { document.getElementById(id).classList.remove('on'); }
function switchModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85 || e.keyCode === 67) || e.keyCode === 123) {
        e.preventDefault(); return false;
    }
});