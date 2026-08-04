const UPSTASH_URL = "https://smooth-werewolf-200782.upstash.io";
const UPSTASH_TOKEN = "gQAAAAAAAxBOAAIgcDFjN2NiMjYxOWNlNjE0NzgyOTExM2JjMjA5ZTc0MjVjMA";

const ADMIN_PHONE = "09904844031";
const ADMIN_PASS = "Par1617230";
const INITIAL_ADMIN_WALLET = 5000000;

let tempUserData = {};
let generatedOTP = "";
let currentAdminChatPhone = null;
let banTargetPhone = null;
let walletTargetPhone = null;
let isSending = false;

document.addEventListener('DOMContentLoaded', () => {
    const loaderFill = document.getElementById('loaderFill');
    if (loaderFill) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            if (progress >= 100) { progress = 100; clearInterval(interval); }
            loaderFill.style.width = progress + '%';
        }, 140);
    }

    const slides = document.querySelectorAll('.slide');
    let cur = 0;
    if (slides.length > 0) {
        setInterval(() => {
            slides[cur].classList.remove('on');
            cur = (cur + 1) % slides.length;
            slides[cur].classList.add('on');
        }, 3000);
    }

    const loaderVideo = document.getElementById('loaderVideo');
    if (loaderVideo) loaderVideo.play().catch(() => {});

    updateUI();
});

setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        loader.style.pointerEvents = 'none';
        setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 500);
    }
}, 8000);

async function redisCommand(command, ...args) {
    try {
        const response = await fetch(`${UPSTASH_URL}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([command, ...args])
        });
        const data = await response.json();
        if (data.error) return null;
        return data.result;
    } catch (e) {
        console.error("Redis Error:", e);
        return null;
    }
}

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
    if (!toast) return;
    toast.textContent = message;
    toast.className = `show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

function getCurrentUser() { 
    try { return JSON.parse(localStorage.getItem('an_current_user')); } 
    catch(e) { return null; }
}
function setCurrentUser(user) { localStorage.setItem('an_current_user', JSON.stringify(user)); }
function clearCurrentUser() { localStorage.removeItem('an_current_user'); }

async function updateAdminWalletDisplay() {
    const balance = await redisCommand('GET', 'admin:wallet');
    const balanceEl = document.getElementById('adminWalletBalance');
    if (balanceEl) {
        balanceEl.textContent = (balance ? parseInt(balance) : INITIAL_ADMIN_WALLET).toLocaleString('fa-IR') + ' تومان';
    }
}

function toggleMenu() { 
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open'); 
}

document.addEventListener('click', e => {
    const m = document.getElementById('sidebar');
    const b = document.querySelector('.menu-btn');
    if (m && b && !m.contains(e.target) && !b.contains(e.target) && m.classList.contains('open')) {
        m.classList.remove('open');
    }
});

let tempAvatar = '';
// ✅ محدودیت حجم عکس برای جلوگیری از کندی دیتابیس (حداکثر 500 کیلوبایت)
function previewAvatar(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 500000) {
        showToast('حجم عکس باید کمتر از 500 کیلوبایت باشد تا سرعت سایت حفظ شود', 'error');
        e.target.value = '';
        return;
    }
    const r = new FileReader();
    r.onload = ev => {
        tempAvatar = ev.target.result;
        const preview = document.getElementById('avatarPreview');
        if (preview) preview.innerHTML = `<img src="${tempAvatar}">`;
    };
    r.readAsDataURL(f);
}

async function requestOTP() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value.trim();

    if (!name || !phone || !password) return showToast('لطفاً تمام فیلدها را پر کنید', 'error');
    if (!/^09\d{9}$/.test(phone)) return showToast('شماره موبایل نامعتبر است', 'error');
    if (password.length < 6) return showToast('رمز عبور باید حداقل ۶ کاراکتر باشد', 'error');

    const exists = await redisCommand('GET', `user:${phone}`);
    if (exists) return showToast('این شماره قبلاً ثبت‌نام کرده است', 'error');

    generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
    const otpDisplay = document.getElementById('otpCodeDisplay');
    const otpInput = document.getElementById('otpInput');
    if (otpDisplay) otpDisplay.textContent = generatedOTP;
    if (otpInput) otpInput.value = '';

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

async function verifyOTP() {
    const inputOTP = document.getElementById('otpInput').value.trim();
    if (inputOTP !== generatedOTP) return showToast('کد تایید اشتباه است', 'error');

    const newUser = { ...tempUserData, id: Date.now() };
    await redisCommand('SET', `user:${newUser.phone}`, JSON.stringify(newUser));
    await redisCommand('SADD', 'users:all', newUser.phone);

    if (newUser.isAdmin) {
        const currentAdminWallet = await redisCommand('GET', 'admin:wallet');
        if (!currentAdminWallet) await redisCommand('SET', 'admin:wallet', INITIAL_ADMIN_WALLET);
    }

    setCurrentUser(newUser);
    closeModal('otpModal');
    tempAvatar = '';
    tempUserData = {};

    showToast('ثبت‌نام با موفقیت انجام شد! خوش آمدید ' + newUser.name, 'success');

    setTimeout(() => {
        updateUI();
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('open');
        if (newUser.isAdmin) setTimeout(() => openAdminPanel(), 1500);
    }, 300);
}

async function handleLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!phone || !password) return showToast('لطفاً شماره و رمز عبور را وارد کنید', 'error');

    if (phone === ADMIN_PHONE && simpleHash(password) === simpleHash(ADMIN_PASS)) {
        let adminProfileStr = await redisCommand('GET', `user:${ADMIN_PHONE}`);
        let adminProfile = adminProfileStr ? JSON.parse(adminProfileStr) : null;

        if (!adminProfile) {
            adminProfile = {
                id: 1, name: 'مدیر سیستم', phone: ADMIN_PHONE, password: simpleHash(ADMIN_PASS),
                isAdmin: true, avatar: 'https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff',
                wallet: INITIAL_ADMIN_WALLET, joinDate: new Date().toLocaleDateString('fa-IR')
            };
            await redisCommand('SET', `user:${ADMIN_PHONE}`, JSON.stringify(adminProfile));
            await redisCommand('SADD', 'users:all', ADMIN_PHONE);
            await redisCommand('SET', 'admin:wallet', INITIAL_ADMIN_WALLET);
            showToast('پروفایل مدیر ساخته شد با موجودی ۵,۰۰۰,۰۰۰ تومان', 'success');
        }
        setCurrentUser(adminProfile);
        closeModal('loginModal');
        showToast('خوش آمدید مدیر عزیز', 'success');
        updateUI();
        setTimeout(openAdminPanel, 500);
        return;
    }

    const userStr = await redisCommand('GET', `user:${phone}`);
    const user = userStr ? JSON.parse(userStr) : null;

    if (user && user.password === simpleHash(password)) {
        setCurrentUser(user);
        closeModal('loginModal');
        showToast('خوش آمدید ' + user.name, 'success');
        updateUI();
        if (user.isAdmin) setTimeout(openAdminPanel, 500);
    } else {
        showToast('شماره موبایل یا رمز عبور اشتباه است', 'error');
    }
}

async function handleForgot() {
    const phone = document.getElementById('forgotPhone').value.trim();
    if (!phone) return showToast('لطفاً شماره موبایل را وارد کنید', 'error');
    if (phone === ADMIN_PHONE) {
        showToast('رمز عبور مدیر: ' + ADMIN_PASS, 'info');
        closeModal('forgotModal');
        return;
    }
    const userStr = await redisCommand('GET', `user:${phone}`);
    const user = userStr ? JSON.parse(userStr) : null;
    if (user) {
        showToast('رمز عبور شما: ' + user.password, 'info');
        closeModal('forgotModal');
    } else {
        showToast('این شماره ثبت‌نام نشده است', 'error');
    }
}

function handleLogout() {
    clearCurrentUser();
    toggleMenu();
    showToast('با موفقیت خارج شدید', 'info');
    updateUI();
}

function openSettingsPage() {
    const user = getCurrentUser();
    if (!user) return showToast('لطفاً ابتدا وارد شوید', 'error');
    const settingsPage = document.getElementById('settingsPage');
    if (settingsPage) {
        document.getElementById('settingsAvatar').src = user.avatar;
        document.getElementById('settingsName').value = user.name;
        document.getElementById('settingsPhone').value = user.phone;
        document.getElementById('settingsJoinDate').value = user.joinDate || 'نامشخص';
        document.getElementById('walletAmount').textContent = (user.wallet || 0).toLocaleString('fa-IR') + ' تومان';
        settingsPage.classList.add('on');
    }
}

function closeSettingsPage() { 
    const settingsPage = document.getElementById('settingsPage');
    if (settingsPage) settingsPage.classList.remove('on'); 
}

async function changeAvatar(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 500000) {
        showToast('حجم عکس باید کمتر از 500 کیلوبایت باشد', 'error');
        return;
    }
    const r = new FileReader();
    r.onload = async ev => {
        const newAvatar = ev.target.result;
        const user = getCurrentUser();
        const userStr = await redisCommand('GET', `user:${user.phone}`);
        const userData = userStr ? JSON.parse(userStr) : user;
        userData.avatar = newAvatar;
        await redisCommand('SET', `user:${user.phone}`, JSON.stringify(userData));
        setCurrentUser(userData);
        updateUI();
        showToast('عکس پروفایل با موفقیت تغییر کرد', 'success');
    };
    r.readAsDataURL(f);
}

async function changeName() {
    const newName = document.getElementById('settingsName').value.trim();
    if (!newName) return showToast('نام نمی‌تواند خالی باشد', 'error');
    const user = getCurrentUser();
    const userStr = await redisCommand('GET', `user:${user.phone}`);
    const userData = userStr ? JSON.parse(userStr) : user;
    userData.name = newName;
    userData.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=${user.isAdmin ? 'ef4444' : '3b82f6'}&color=fff`;
    await redisCommand('SET', `user:${user.phone}`, JSON.stringify(userData));
    setCurrentUser(userData);
    updateUI();
    showToast('نام با موفقیت تغییر کرد', 'success');
}

async function changePassword() {
    const currentPass = document.getElementById('currentPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();
    if (!currentPass || !newPass || !confirmPass) return showToast('لطفاً تمام فیلدها را پر کنید', 'error');
    if (newPass.length < 6) return showToast('رمز عبور جدید باید حداقل ۶ کاراکتر باشد', 'error');
    if (newPass !== confirmPass) return showToast('رمز عبور جدید و تکرار آن مطابقت ندارند', 'error');
    const user = getCurrentUser();
    const userStr = await redisCommand('GET', `user:${user.phone}`);
    const userData = userStr ? JSON.parse(userStr) : user;
    if (userData.password !== simpleHash(currentPass)) return showToast('رمز عبور فعلی اشتباه است', 'error');
    userData.password = simpleHash(newPass);
    await redisCommand('SET', `user:${user.phone}`, JSON.stringify(userData));
    setCurrentUser(userData);
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
    const chatFab = document.getElementById('chatFab');

    if (user) {
        const avatarEl = document.getElementById('sidebarAvatar');
        const nameEl = document.getElementById('sidebarName');
        const phoneEl = document.getElementById('sidebarPhone');
        if (avatarEl) avatarEl.src = user.avatar;
        if (nameEl) nameEl.textContent = user.name;
        if (phoneEl) phoneEl.textContent = user.phone;
        if (sidebarProfile) sidebarProfile.classList.add('visible');
        if (sidebarLogout) sidebarLogout.classList.add('visible');
        if (menuLogin) menuLogin.classList.remove('visible');
        if (menuSettings) menuSettings.classList.add('visible');
        if (chatFab) chatFab.classList.add('visible');
        if (user.isAdmin) { if (menuAdmin) menuAdmin.classList.add('visible'); } 
        else { if (menuAdmin) menuAdmin.classList.remove('visible'); }
    } else {
        if (sidebarProfile) sidebarProfile.classList.remove('visible');
        if (sidebarLogout) sidebarLogout.classList.remove('visible');
        if (menuLogin) menuLogin.classList.add('visible');
        if (menuSettings) menuSettings.classList.remove('visible');
        if (menuAdmin) menuAdmin.classList.remove('visible');
        if (chatFab) chatFab.classList.remove('visible');
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
    const isBanned = await redisCommand('GET', `ban:${user.phone}`);
    if (isBanned) {
        showToast('⛔ حساب شما از چت محروم شده است. با پشتیبانی تماس بگیرید.', 'error');
        return;
    }
    toggleChatBox();
    await loadUserChat(user.phone);
}

function toggleChatBox() { 
    const chatBox = document.getElementById('chatBox');
    if (chatBox) chatBox.classList.toggle('on');
}

async function loadUserChat(phone) {
    const msgsStr = await redisCommand('LRANGE', `chat:${phone}`, 0, -1);
    const msgs = msgsStr ? msgsStr.map(m => JSON.parse(m)).reverse() : [];
    const container = document.getElementById('chatMsgs');
    if (!container) return;

    container.innerHTML = '';
    if (msgs.length === 0) {
        container.innerHTML = `<div class="msg admin">سلام! چطور می‌توانم کمکتان کنم؟<span class="time">سیستم</span></div>`;
    } else {
        const fragment = document.createDocumentFragment();
        msgs.forEach(m => {
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
            fragment.appendChild(div);
        });
        container.appendChild(fragment);
    }
    container.scrollTop = container.scrollHeight;
}

async function sendUserMsg() {
    if (isSending) return;
    const user = getCurrentUser();
    const input = document.getElementById('chatInput');
    const text = input ? input.value.trim() : '';
    if (!text || !user) return;

    const isBanned = await redisCommand('GET', `ban:${user.phone}`);
    if (isBanned) {
        showToast('⛔ حساب شما از چت محروم شده است', 'error');
        return;
    }

    isSending = true;
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }
    if (input) input.disabled = true;

    try {
        const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
        const msg = {
            id: Date.now(), userPhone: user.phone, userName: user.name, userAvatar: user.avatar,
            sender: 'user', text: text, time: time, timestamp: Date.now(), read: false
        };
        await redisCommand('LPUSH', `chat:${user.phone}`, JSON.stringify(msg));
        if (input) input.value = '';
        await loadUserChat(user.phone);
    } catch (err) {
        console.error('خطا در ارسال پیام:', err);
        showToast('❌ خطا در ارسال پیام', 'error');
    }

    isSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
    if (input) { input.disabled = false; input.focus(); }
}

async function openAdminPanel() {
    const user = getCurrentUser();
    if (!user || !user.isAdmin) return showToast('دسترسی غیرمجاز', 'error');
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.classList.add('on');
    await updateAdminWalletDisplay();
    await loadAdminData();
}

function closeAdminPanel() { 
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.classList.remove('on');
}

function switchAdminTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('on'));
    btn.classList.add('on');
    const usersTab = document.getElementById('adminUsersTab');
    const chatsTab = document.getElementById('adminChatsTab');
    const broadcastTab = document.getElementById('adminBroadcastTab');
    if (usersTab) usersTab.style.display = tab === 'users' ? 'block' : 'none';
    if (chatsTab) chatsTab.style.display = tab === 'chats' ? 'block' : 'none';
    if (broadcastTab) broadcastTab.style.display = tab === 'broadcast' ? 'block' : 'none';
    if (tab === 'chats') loadAdminChats();
    if (tab === 'users') loadAdminData();
}

async function loadAdminData() {
    const phones = await redisCommand('SMEMBERS', 'users:all');
    const list = document.getElementById('adminUserList');
    if (!list) return;
    list.innerHTML = '';
    if (!phones || phones.length === 0) {
        list.innerHTML = '<p style="text-align:center;padding:20px;color:#64748b">هنوز کاربری ثبت‌نام نکرده است</p>';
        return;
    }
    for (const phone of phones) {
        const userStr = await redisCommand('GET', `user:${phone}`);
        if (!userStr) continue;
        const u = JSON.parse(userStr);
        if (u.phone === ADMIN_PHONE) {
            list.innerHTML += `<div class="user-list-item" style="background:#f0fdf4;border:1px solid #10b981;border-radius:10px"><img src="${u.avatar}" alt="${u.name}"><div class="user-list-item-info"><h4>${u.name} <span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-right:5px">مدیر</span></h4><p>${u.phone} | موجودی: ${(u.wallet || 0).toLocaleString('fa-IR')} تومان</p></div></div>`;
            continue;
        }
        const isBanned = await redisCommand('GET', `ban:${u.phone}`);
        const bannedBadge = isBanned ? `<span class="banned-badge">بن</span>` : '';
        const walletBadge = `<span class="wallet-badge">${(u.wallet || 0).toLocaleString('fa-IR')} ت</span>`;
        list.innerHTML += `<div class="user-list-item"><img src="${u.avatar}" alt="${u.name}"><div class="user-list-item-info"><h4>${u.name} ${bannedBadge} ${walletBadge}</h4><p>${u.phone}</p></div><div class="user-actions"><button class="btn-small btn-wallet" onclick="openWalletModal('${u.phone}', '${u.name}', ${u.wallet || 0})">💰 شارژ</button>${isBanned ? `<button class="btn-small btn-unban" onclick="unbanUser('${u.phone}')">رفع بن</button>` : `<button class="btn-small btn-ban" onclick="openBanModal('${u.phone}', '${u.name}')">بن</button>`}</div></div>`;
    }
}

function openBanModal(phone, name) { 
    banTargetPhone = phone; 
    if (document.getElementById('banUserName')) document.getElementById('banUserName').textContent = name;
    if (document.getElementById('banDuration')) document.getElementById('banDuration').value = '24';
    if (document.getElementById('banReason')) document.getElementById('banReason').value = '';
    openModal('banModal'); 
}

async function confirmBan() {
    if (!banTargetPhone) return;
    const duration = document.getElementById('banDuration').value;
    const reason = document.getElementById('banReason').value.trim();
    await redisCommand('SETEX', `ban:${banTargetPhone}`, duration === 'permanent' ? 31536000 : duration * 3600, reason || 'بدون دلیل');
    closeModal('banModal');
    showToast('کاربر با موفقیت محروم شد', 'success');
    await loadAdminData();
}

async function unbanUser(phone) {
    await redisCommand('DEL', `ban:${phone}`);
    showToast('محرومیت کاربر برطرف شد', 'success');
    await loadAdminData();
}

function openWalletModal(phone, name, currentBalance) {
    walletTargetPhone = phone;
    redisCommand('GET', 'admin:wallet').then(adminBal => {
        if (document.getElementById('walletUserName')) document.getElementById('walletUserName').textContent = name;
        if (document.getElementById('walletCurrentBalance')) document.getElementById('walletCurrentBalance').textContent = currentBalance.toLocaleString('fa-IR');
        if (document.getElementById('walletPanelBalance')) document.getElementById('walletPanelBalance').textContent = (adminBal ? parseInt(adminBal) : INITIAL_ADMIN_WALLET).toLocaleString('fa-IR');
        if (document.getElementById('walletAmountInput')) document.getElementById('walletAmountInput').value = '';
        openModal('walletModal');
    });
}

async function confirmWalletAdd() {
    if (!walletTargetPhone) return;
    const amount = parseInt(document.getElementById('walletAmountInput').value);
    if (!amount || amount <= 0) return showToast('لطفاً مبلغ معتبر وارد کنید', 'error');
    const adminBalStr = await redisCommand('GET', 'admin:wallet');
    const adminBalance = adminBalStr ? parseInt(adminBalStr) : INITIAL_ADMIN_WALLET;
    if (adminBalance < amount) {
        showToast(`موجودی پنل کافی نیست! موجودی فعلی: ${adminBalance.toLocaleString('fa-IR')} تومان`, 'error');
        return;
    }
    await redisCommand('SET', 'admin:wallet', adminBalance - amount);
    const userStr = await redisCommand('GET', `user:${walletTargetPhone}`);
    const userData = userStr ? JSON.parse(userStr) : null;
    if (userData) {
        userData.wallet = (userData.wallet || 0) + amount;
        await redisCommand('SET', `user:${walletTargetPhone}`, JSON.stringify(userData));
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.phone === walletTargetPhone) {
            currentUser.wallet = userData.wallet;
            setCurrentUser(currentUser);
        }
        closeModal('walletModal');
        showToast(`✅ ${amount.toLocaleString('fa-IR')} تومان به کیف پول ${userData.name} شارژ شد`, 'success');
        await updateAdminWalletDisplay();
        await loadAdminData();
    }
}

function openAdminWalletAddModal() {
    redisCommand('GET', 'admin:wallet').then(bal => {
        if (document.getElementById('adminCurrentWallet')) document.getElementById('adminCurrentWallet').textContent = (bal ? parseInt(bal) : INITIAL_ADMIN_WALLET).toLocaleString('fa-IR');
        if (document.getElementById('adminWalletAddAmount')) document.getElementById('adminWalletAddAmount').value = '';
        openModal('adminWalletAddModal');
    });
}

async function confirmAdminWalletAdd() {
    const amount = parseInt(document.getElementById('adminWalletAddAmount').value);
    if (!amount || amount <= 0) return showToast('لطفاً مبلغ معتبر وارد کنید', 'error');
    const balStr = await redisCommand('GET', 'admin:wallet');
    const currentBal = balStr ? parseInt(balStr) : INITIAL_ADMIN_WALLET;
    await redisCommand('SET', 'admin:wallet', currentBal + amount);
    closeModal('adminWalletAddModal');
    await updateAdminWalletDisplay();
    showToast(`✅ ${amount.toLocaleString('fa-IR')} تومان به کیف پول پنل اضافه شد`, 'success');
}

async function loadAdminChats() {
    const phones = await redisCommand('SMEMBERS', 'users:all');
    const list = document.getElementById('adminChatList');
    if (!list) return;
    list.innerHTML = '';
    if (!phones) return;
    let hasChats = false;
    for (const phone of phones) {
        if (phone === ADMIN_PHONE) continue;
        const msgCount = await redisCommand('LLEN', `chat:${phone}`);
        if (!msgCount || parseInt(msgCount) === 0) continue;
        hasChats = true;
        const userStr = await redisCommand('GET', `user:${phone}`);
        const userData = userStr ? JSON.parse(userStr) : null;
        const userName = userData ? userData.name : 'کاربر ناشناس';
        const userAvatar = userData ? userData.avatar : 'https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff';
        const lastMsgStr = await redisCommand('LRANGE', `chat:${phone}`, 0, 0);
        let lastText = '';
        let unreadCount = 0;
        if (lastMsgStr && lastMsgStr.length > 0) {
            const lastMsg = JSON.parse(lastMsgStr[0]);
            lastText = lastMsg.text;
            const allMsgsStr = await redisCommand('LRANGE', `chat:${phone}`, 0, -1);
            if (allMsgsStr) {
                const allMsgs = allMsgsStr.map(m => JSON.parse(m));
                unreadCount = allMsgs.filter(m => m.sender === 'user' && !m.read).length;
            }
        }
        const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        const previewText = lastText ? (lastText.substring(0, 40) + (lastText.length > 40 ? '...' : '')) : 'بدون پیام';
        list.innerHTML += `<div class="user-list-item" onclick="openAdminChatPage('${phone}')" style="cursor:pointer"><img src="${userAvatar}" alt="${userName}"><div class="user-list-item-info"><h4>${userName} ${unreadBadge}</h4><p>${previewText}</p></div></div>`;
    }
    if (!hasChats) list.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px">هنوز گفتگویی وجود ندارد</p>';
}

async function openAdminChatPage(phone) {
    currentAdminChatPhone = phone;
    const container = document.getElementById('adminChatMsgs');
    if (container) container.innerHTML = '<p style="text-align:center;padding:20px">در حال بارگذاری...</p>';
    const chatPage = document.getElementById('adminChatPage');
    if (chatPage) chatPage.classList.add('on');

    const msgsStr = await redisCommand('LRANGE', `chat:${phone}`, 0, -1);
    const msgs = msgsStr ? msgsStr.map(m => JSON.parse(m)).reverse() : [];
    const userStr = await redisCommand('GET', `user:${phone}`);
    const userData = userStr ? JSON.parse(userStr) : null;
    const userName = userData ? userData.name : 'کاربر';
    const userAvatar = userData ? userData.avatar : 'https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff';

    if (document.getElementById('adminChatUserName')) document.getElementById('adminChatUserName').textContent = userName;
    if (document.getElementById('adminChatUserPhone')) document.getElementById('adminChatUserPhone').textContent = phone;
    if (document.getElementById('adminChatUserAvatar')) document.getElementById('adminChatUserAvatar').src = userAvatar;

    const updatedMsgs = msgs.map(m => { if (m.sender === 'user') m.read = true; return m; });
    await redisCommand('DEL', `chat:${phone}`);
    for (let i = updatedMsgs.length - 1; i >= 0; i--) {
        await redisCommand('LPUSH', `chat:${phone}`, JSON.stringify(updatedMsgs[i]));
    }
    renderAdminChatMsgs(updatedMsgs.reverse());
}

// ✅ تابع جدید: حذف کامل گفتگو از دیتابیس (برای همیشه)
async function deleteCurrentChat() {
    if (!currentAdminChatPhone) return;
    if (confirm('آیا از حذف کامل و دائمی این گفتگو مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
        await redisCommand('DEL', `chat:${currentAdminChatPhone}`);
        showToast('گفتگو با موفقیت و به طور کامل حذف شد', 'success');
        closeAdminChatPage();
        await loadAdminChats(); // به‌روزرسانی لیست
    }
}

function closeAdminChatPage() {
    const chatPage = document.getElementById('adminChatPage');
    if (chatPage) chatPage.classList.remove('on');
    currentAdminChatPhone = null;
}

function renderAdminChatMsgs(msgs) {
    const container = document.getElementById('adminChatMsgs');
    if (!container) return;
    const fragment = document.createDocumentFragment();
    if (msgs.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'text-align:center;color:#64748b;padding:20px';
        p.textContent = 'هنوز پیامی ارسال نشده است';
        fragment.appendChild(p);
    } else {
        msgs.forEach(m => {
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
            fragment.appendChild(div);
        });
    }
    container.innerHTML = '';
    container.appendChild(fragment);
    container.scrollTop = container.scrollHeight;
}

async function sendAdminChatMsg() {
    if (!currentAdminChatPhone) return showToast('ابتدا یک گفتگو را انتخاب کنید', 'error');
    const input = document.getElementById('adminChatInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;
    if (isSending) return;
    isSending = true;
    try {
        const currentUser = getCurrentUser();
        const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
        const msg = {
            id: Date.now(), userPhone: currentAdminChatPhone, userName: currentUser ? currentUser.name : 'مدیر',
            userAvatar: currentUser ? currentUser.avatar : '', sender: 'admin', text: text, time: time, timestamp: Date.now(), read: true
        };
        await redisCommand('LPUSH', `chat:${currentAdminChatPhone}`, JSON.stringify(msg));
        input.value = '';
        const msgsStr = await redisCommand('LRANGE', `chat:${currentAdminChatPhone}`, 0, -1);
        renderAdminChatMsgs(msgsStr ? msgsStr.map(m => JSON.parse(m)).reverse() : []);
    } catch (err) {
        console.error('خطا:', err);
        showToast('❌ خطا در ارسال پیام', 'error');
    }
    isSending = false;
}

async function sendBroadcast() {
    const title = document.getElementById('broadcastTitle').value.trim();
    const message = document.getElementById('broadcastMessage').value.trim();
    const resultDiv = document.getElementById('broadcastResult');
    if (!message) return showToast('لطفاً متن پیام را وارد کنید', 'error');
    const phones = await redisCommand('SMEMBERS', 'users:all');
    const regularUsers = phones ? phones.filter(p => p !== ADMIN_PHONE) : [];
    if (regularUsers.length === 0) {
        if (resultDiv) resultDiv.innerHTML = '<div style="background:#f59e0b;color:#fff;padding:15px;border-radius:10px;margin-top:15px;text-align:center">هیچ کاربر عادی برای ارسال پیام وجود ندارد</div>';
        return;
    }
    const time = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
    const currentUser = getCurrentUser();
    for (const phone of regularUsers) {
        const msg = {
            id: Date.now() + Math.random(), userPhone: phone, userName: currentUser ? currentUser.name : 'مدیر',
            userAvatar: currentUser ? currentUser.avatar : '', sender: 'broadcast', isBroadcast: true,
            broadcastTitle: title || 'اطلاعیه سیستم', text: message, time: time, timestamp: Date.now(), read: false
        };
        await redisCommand('LPUSH', `chat:${phone}`, JSON.stringify(msg));
    }
    if (resultDiv) resultDiv.innerHTML = `<div style="background:#10b981;color:#fff;padding:15px;border-radius:10px;margin-top:15px;text-align:center">✅ پیام با موفقیت به ${regularUsers.length} کاربر ارسال شد</div>`;
    if (document.getElementById('broadcastTitle')) document.getElementById('broadcastTitle').value = '';
    if (document.getElementById('broadcastMessage')) document.getElementById('broadcastMessage').value = '';
    showToast(`پیام به ${regularUsers.length} کاربر ارسال شد`, 'success');
    setTimeout(() => { if (resultDiv) resultDiv.innerHTML = ''; }, 5000);
}

function openModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.add('on'); }
function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove('on'); }
function switchModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 85 || e.keyCode === 67) || e.keyCode === 123) {
        e.preventDefault(); return false;
    }
});