// ============================================================
// amoz.js — نسخه اصلاح‌شده (رفع خطای پیام‌ها + بروزرسانی آنی پنل)
// ============================================================
let currentUser = null;
let currentChatPhone = null;
let currentEditPhone = null;
let currentListType = '';
let currentAttGrade = '';
let currentAttClass = '';
let currentBell = 1;
let currentGradeManage = '';
let currentClassManage = '';
let currentWeeklyGrade = '';
let currentWeeklyClass = '';

// ============ HELPERS ============
function initialOf(n) { return n ? n.trim().charAt(0) : ''; }

function isBanned(u) {
  return !!(u && u.bannedUntil && u.bannedUntil > Date.now());
}

function tickHtml(u) {
  if (!u) return '';
  if (isBanned(u)) return '<span class="tick tick-red">!</span>';
  if (u.role === 'creator') return '<span class="tick tick-black">✓</span>';
  if (u.role === 'support') return '<span class="tick tick-blue">✓</span>';
  if (u.isManager) return '<span class="tick tick-green">✓</span>';
  if (u.isVice) return '<span class="tick tick-green">✓</span>';
  return '';
}

function hasTick(u) {
  return !!(u && (u.role === 'creator' || u.role === 'support' || u.isManager || u.isVice));
}

function hasPanelAccess(u) {
  return hasTick(u) || !!(u && u.isTeacher);
}

function safeName(c) {
  return (c && (c.name || c.phone)) || 'کاربر';
}

// ============ INIT ============
window.onload = async function () {
  const cur = localStorage.getItem('currentUser');
  if (!cur) { window.location.href = 'index.html'; return; }
  const u = await getUser(cur);
  if (!u) { window.location.href = 'index.html'; return; }
  if (isBanned(u)) {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
    return;
  }
  currentUser = u;
  loadHome();
  loadSettings();
};

function goPage(name) {
  document.querySelectorAll('.screen').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  document.querySelectorAll('.bottom-nav').forEach(nav => {
    nav.querySelectorAll('.nav-item').forEach(it => {
      it.classList.toggle('active', it.dataset.page === name);
    });
  });
  if (name === 'messages') loadMessages();
  if (name === 'settings') loadSettings();
  if (name === 'panel') loadPanel();
  if (name === 'edit-profile') fillEditProfile();
}

// ============ HOME ============
function loadHome() {
  document.getElementById('home-name').innerHTML =
    (currentUser.name || 'کاربر') + ' ' + tickHtml(currentUser);

  const parts = [];
  if (currentUser.isManager) parts.push('مدیر');
  else if (currentUser.isVice) parts.push('معاون');
  else if (currentUser.isTeacher) parts.push('معلم');
  if (currentUser.role === 'creator') parts.push('سازنده');
  if (currentUser.role === 'support') parts.push('پشتیبانی');
  if (currentUser.city || currentUser.province) parts.push(currentUser.city || currentUser.province);
  if (currentUser.school) parts.push(currentUser.school);
  if (currentUser.grade) parts.push(currentUser.grade);

  document.getElementById('home-info').textContent = parts.join(' | ') || 'آموزیار';

  const av = document.getElementById('home-avatar');
  if (currentUser.avatar) {
    av.style.backgroundImage = `url(${currentUser.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(currentUser.name);
  }
}

// ============ SETTINGS ============
function loadSettings() {
  const av = document.getElementById('settings-avatar');
  if (currentUser.avatar) {
    av.style.backgroundImage = `url(${currentUser.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(currentUser.name);
  }

  let tickCls = '';
  if (currentUser.role === 'creator') tickCls = 'black';
  else if (currentUser.role === 'support') tickCls = 'blue';
  else if (currentUser.isManager || currentUser.isVice) tickCls = 'green';

  document.getElementById('settings-name').innerHTML =
    (currentUser.name || 'کاربر') +
    (tickCls ? ` <span class="tick-big ${tickCls}">✓</span>` : '');

  document.getElementById('btn-panel').style.display =
    hasPanelAccess(currentUser) ? 'block' : 'none';
}

async function changeAvatar(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async (ev) => {
    currentUser.avatar = ev.target.result;
    await saveUser(currentUser.phone, currentUser);
    loadHome();
    loadSettings();
  };
  r.readAsDataURL(f);
}

// ============ EDIT PROFILE ============
function fillEditProfile() {
  document.getElementById('ep-name').value = currentUser.name || '';
  document.getElementById('ep-pass').value = '';
  document.getElementById('ep-province').value = currentUser.province || '';
  document.getElementById('ep-city').value = currentUser.city || '';
  document.getElementById('ep-school').value = currentUser.school || '';
  document.getElementById('ep-grade').value = currentUser.grade || '';
  document.getElementById('ep-error').style.display = 'none';
}

async function saveProfileEdit() {
  const n = document.getElementById('ep-name').value.trim();
  const p = document.getElementById('ep-pass').value;
  const err = document.getElementById('ep-error');
  if (!n) { err.style.display = 'block'; err.textContent = 'نام خالی است'; return; }
  currentUser.name = n;
  if (p) currentUser.password = p;
  currentUser.province = document.getElementById('ep-province').value.trim();
  currentUser.city = document.getElementById('ep-city').value.trim();
  currentUser.school = document.getElementById('ep-school').value.trim();
  currentUser.grade = document.getElementById('ep-grade').value.trim();
  await saveUser(currentUser.phone, currentUser);
  loadHome();
  loadSettings();
  goPage('settings');
}

// ============ MESSAGES (اصلاح‌شده — بدون خطا، پشتیبانی همیشه هست) ============
async function loadMessages() {
  const container = document.getElementById('messages-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  try {
    const myPhone = currentUser.phone;
    const contacts = [];
    const seen = new Set();

    // ۱) پشتیبانی اصلی همیشه اول (اگر خودم پشتیبانی نباشم)
    let mainSup = '';
    try { mainSup = await getSupportPhone(); } catch (e) {}
    if (mainSup && String(mainSup) !== String(myPhone)) {
      const su = await getUser(mainSup);
      if (su) { contacts.push(su); seen.add(su.phone); }
    }

    if (hasTick(currentUser)) {
      // ۲) پنل‌دار → مخاطبین خودش (کسانی که به او پیام داده‌اند)
      let cPhones = [];
      try { cPhones = await getContacts(myPhone); } catch (e) { cPhones = []; }
      if (Array.isArray(cPhones)) {
        for (const p of cPhones) {
          if (!p || seen.has(p)) continue;
          const u = await getUser(p);
          if (u) { contacts.push(u); seen.add(p); }
        }
      }
    } else {
      // ۳) کاربر عادی → همه کسانی که تیک دارند
      let all = [];
      try { all = await getAllUsers(); } catch (e) { all = []; }
      if (Array.isArray(all)) {
        for (const u of all) {
          if (!u || !u.phone) continue;
          if (String(u.phone) === String(myPhone)) continue;
          if (seen.has(u.phone)) continue;
          if (hasTick(u)) { contacts.push(u); seen.add(u.phone); }
        }
      }
    }

    container.innerHTML = '';
    if (contacts.length === 0) {
      container.innerHTML = '<div class="empty-state">هنوز پیامی نیست</div>';
      return;
    }

    contacts.forEach(c => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.onclick = () => openChat(c.phone);
      const av = c.avatar
        ? `<div class="avatar-mini" style="background-image:url(${c.avatar})"></div>`
        : `<div class="avatar-mini">${initialOf(safeName(c))}</div>`;
      let roleLabel = '';
      if (c.role === 'support') roleLabel = 'پشتیبانی';
      else if (c.role === 'creator') roleLabel = 'سازنده';
      else if (c.isManager) roleLabel = 'مدیر';
      else if (c.isVice) roleLabel = 'معاون';
      else if (c.isTeacher) roleLabel = 'معلم';
      div.innerHTML = `${av}<div class="info"><strong>${safeName(c)} ${tickHtml(c)}</strong><small>${roleLabel || c.phone}</small></div>`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error('loadMessages:', e);
    container.innerHTML = '<div class="empty-state">خطا در بارگذاری پیام‌ها</div>';
  }
}

async function openChat(contactPhone) {
  currentChatPhone = contactPhone;
  goPage('chat');

  const contact = await getUser(contactPhone);
  document.getElementById('chat-name').innerHTML =
    (contact ? safeName(contact) : 'گفتگو') + ' ' + tickHtml(contact);
  document.getElementById('chat-sub').textContent = contactPhone;

  const av = document.getElementById('chat-avatar');
  if (contact && contact.avatar) {
    av.style.backgroundImage = `url(${contact.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(contact ? safeName(contact) : 'گ');
  }

  const msgs = await getChatBetween(currentUser.phone, contactPhone);
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  if (!msgs || msgs.length === 0) {
    container.innerHTML = '<div class="empty-state">هنوز پیامی رد و بدل نشده</div>';
    return;
  }
  msgs.forEach(m => {
    const div = document.createElement('div');
    const mine = m.from === currentUser.phone;
    div.className = 'chat-msg ' + (mine ? 'mine' : 'theirs');
    let inner = '';
    if (m.type === 'image') inner = `<img src="${m.content}">`;
    else if (m.type === 'audio') inner = `<audio controls src="${m.content}"></audio>`;
    else if (m.type === 'video') inner = `<video controls src="${m.content}"></video>`;
    else if (m.type === 'file') inner = `<a class="file-link" href="${m.content.data}" download="${m.content.name}">📄 ${m.content.name}</a>`;
    else inner = m.content;
    inner += `<small>${new Date(m.ts).toLocaleTimeString('fa-IR')}</small>`;
    div.innerHTML = inner;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendChatText() {
  const input = document.getElementById('chat-input');
  const txt = input.value.trim();
  if (!txt) return;
  if (!currentChatPhone) return;
  input.value = '';
  await sendMsg(currentUser.phone, currentChatPhone, 'text', txt);
  openChat(currentChatPhone);
}

async function sendChatFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  e.target.value = '';
  const maxSize = 800 * 1024;
  if (f.size > maxSize) { alert('حجم فایل زیاد است (حداکثر ۸۰۰ کیلوبایت)'); return; }
  const r = new FileReader();
  r.onload = async (ev) => {
    const dataUrl = ev.target.result;
    let type = 'file';
    if (f.type.startsWith('image/')) type = 'image';
    else if (f.type.startsWith('audio/')) type = 'audio';
    else if (f.type.startsWith('video/')) type = 'video';
    let content = dataUrl;
    if (type === 'file') content = { name: f.name, data: dataUrl };
    await sendMsg(currentUser.phone, currentChatPhone, type, content);
    openChat(currentChatPhone);
  };
  r.readAsDataURL(f);
}

async function deleteCurrentChat() {
  if (!confirm('گفتگو برای هر دو طرف حذف شود؟')) return;
  await deleteChatBetween(currentUser.phone, currentChatPhone);
  openChat(currentChatPhone);
}

// ============ PANEL MENU ============
function loadPanel() {
  const menu = document.getElementById('panel-menu');
  menu.innerHTML = '';
  const items = [];
  const u = currentUser;
  const isCreator = u.role === 'creator';
  const isSupport = u.role === 'support';
  const isManager = u.isManager;
  const isVice = u.isVice;
  const isTeacher = u.isTeacher;

  if (isCreator || isManager || isVice || isTeacher) {
    items.push({ label: 'لیست معلم‌ها', action: () => openList('teacher') });
  }
  if (isCreator || isManager) {
    items.push({ label: 'لیست معاون‌ها', action: () => openList('vice') });
  }
  if (isCreator) {
    items.push({ label: 'لیست مدیرها', action: () => openList('manager') });
  }
  if (isCreator || isManager || isSupport) {
    items.push({ label: 'لیست کاربران', action: () => openList('user') });
    items.push({ label: 'رفع بن‌ها', action: () => openList('banned') });
  }
  if (isCreator || isManager || isVice || isTeacher) {
    items.push({ label: 'حضور و غیاب', action: () => goPage('att-grades') });
    items.push({ label: 'حضور هفتگی', action: () => goPage('weekly-att') });
  }
  if (isCreator || isManager || isSupport) {
    items.push({ label: 'مدیریت لیست کلاس‌ها', action: () => goPage('creator-lists') });
  }
  if (isTeacher) {
    items.push({ label: 'لیست نمرات', action: () => alert('به زودی') });
  }

  items.forEach(it => {
    const div = document.createElement('div');
    div.className = 'menu-item';
    div.innerHTML = `<span>${it.label}</span>`;
    div.onclick = it.action;
    menu.appendChild(div);
  });
}

// ============ LIST (با silent برای بروزرسانی آنی بدون فلش) ============
async function openList(type, silent) {
  currentListType = type;
  if (!silent) goPage('list');

  const titles = {
    teacher: 'لیست معلم‌ها',
    vice: 'لیست معاون‌ها',
    manager: 'لیست مدیرها',
    user: 'لیست کاربران',
    banned: 'کاربران بن شده'
  };
  document.getElementById('list-title').textContent = titles[type] || 'لیست';

  const canAdd = (currentUser.role === 'creator' || currentUser.isManager || currentUser.isVice)
    && ['teacher', 'vice', 'manager'].includes(type);
  if (type === 'manager' && currentUser.role !== 'creator') {
    document.getElementById('list-add-btn').style.display = 'none';
  } else {
    document.getElementById('list-add-btn').style.display = canAdd ? 'block' : 'none';
  }
  if (type === 'user' || type === 'banned') {
    document.getElementById('list-add-btn').style.display = 'none';
  }

  const container = document.getElementById('list-container');
  if (!silent) container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  try {
    let users = await getAllUsers();
    if (type === 'teacher') users = users.filter(u => u.isTeacher);
    else if (type === 'vice') users = users.filter(u => u.isVice);
    else if (type === 'manager') users = users.filter(u => u.isManager);
    else if (type === 'user') users = users.filter(u =>
      u.role !== 'creator' && u.role !== 'support' && !isBanned(u));
    else if (type === 'banned') users = users.filter(u => isBanned(u));

    container.innerHTML = '';
    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state">کسی نیست</div>';
      return;
    }
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.onclick = () => openEditUser(u.phone);
      const av = u.avatar
        ? `<div class="avatar-mini" style="background-image:url(${u.avatar})"></div>`
        : `<div class="avatar-mini">${initialOf(u.name)}</div>`;
      div.innerHTML = `${av}<div class="info"><strong>${u.name || 'بدون نام'} ${tickHtml(u)}</strong><small>${u.phone}</small></div>`;
      container.appendChild(div);
    });
  } catch (e) {
    console.error('openList:', e);
    if (!silent) container.innerHTML = '<div class="empty-state">خطا</div>';
  }
}

async function openEditUser(phone) {
  currentEditPhone = phone;
  const u = await getUser(phone);
  if (!u) return;
  goPage('edit-user');
  document.getElementById('eu-name').value = u.name || '';
  document.getElementById('eu-phone').value = phone;
  document.getElementById('eu-pass').value = '';
  document.getElementById('eu-school').value = u.school || '';
  document.getElementById('eu-error').style.display = 'none';

  const togglesDiv = document.getElementById('eu-toggles');
  togglesDiv.innerHTML = '';

  const isCreator = currentUser.role === 'creator';
  const isManager = currentUser.isManager;
  const isVice = currentUser.isVice;

  const addToggle = (label, key, canToggle) => {
    if (!canToggle) return;
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = `<label>${label}</label>
      <input type="checkbox" id="tog-${key}" ${u[key] ? 'checked' : ''}>`;
    togglesDiv.appendChild(row);
  };

  addToggle('معلم', 'isTeacher', isCreator || isManager || isVice);
  addToggle('معاون', 'isVice', isCreator || isManager);
  addToggle('مدیر', 'isManager', isCreator);
}

async function saveUserEdit() {
  const u = await getUser(currentEditPhone);
  if (!u) return;
  const n = document.getElementById('eu-name').value.trim();
  const p = document.getElementById('eu-pass').value;
  const err = document.getElementById('eu-error');
  if (!n) { err.style.display = 'block'; err.textContent = 'نام خالی است'; return; }
  u.name = n;
  if (p) u.password = p;
  u.school = document.getElementById('eu-school').value.trim();

  ['isTeacher', 'isVice', 'isManager'].forEach(k => {
    const el = document.getElementById('tog-' + k);
    if (el) u[k] = el.checked;
  });

  await saveUser(currentEditPhone, u);
  goPage('list');
  await openList(currentListType, true);
}

async function banAction() {
  if (!confirm('بن ۷ روز؟')) return;
  const u = await getUser(currentEditPhone);
  if (!u) return;
  u.bannedUntil = Date.now() + 7 * 86400000;
  await saveUser(currentEditPhone, u);
  goPage('list');
  await openList(currentListType, true);
}

async function unbanAction() {
  const u = await getUser(currentEditPhone);
  if (!u) return;
  u.bannedUntil = null;
  await saveUser(currentEditPhone, u);
  goPage('list');
  await openList(currentListType, true);
}

async function deleteAction() {
  if (!confirm('حذف دائمی؟')) return;
  await deleteUser(currentEditPhone);
  goPage('list');
  await openList(currentListType, true);
}

function openAddPerson() {
  goPage('add-person');
  const titles = { teacher: 'افزودن معلم', vice: 'افزودن معاون', manager: 'افزودن مدیر' };
  document.getElementById('add-title').textContent = titles[currentListType] || 'افزودن';
  document.getElementById('add-name').value = '';
  document.getElementById('add-phone').value = '';
  document.getElementById('add-pass').value = '';
  document.getElementById('add-school').value = '';
  document.getElementById('add-error').style.display = 'none';
}

async function submitAddPerson() {
  const n = document.getElementById('add-name').value.trim();
  const ph = document.getElementById('add-phone').value.trim();
  const pw = document.getElementById('add-pass').value;
  const school = document.getElementById('add-school').value.trim();
  const err = document.getElementById('add-error');
  if (!n) { err.style.display = 'block'; err.textContent = 'نام خالی'; return; }
  if (!/^09\d{9}$/.test(ph)) { err.style.display = 'block'; err.textContent = 'شماره نامعتبر'; return; }
  if (pw.length < 6) { err.style.display = 'block'; err.textContent = 'رمز حداقل ۶'; return; }
  if (await getUser(ph)) { err.style.display = 'block'; err.textContent = 'شماره تکراری'; return; }

  const newU = {
    name: n, password: pw, avatar: '',
    province: currentUser.province || '',
    city: currentUser.city || '',
    school: school || currentUser.school || '',
    grade: '',
    isManager: currentListType === 'manager',
    isTeacher: currentListType === 'teacher',
    isVice: currentListType === 'vice',
    role: 'user',
    bannedUntil: null,
    createdAt: Date.now()
  };
  await saveUser(ph, newU);
  goPage('list');
  await openList(currentListType, true);
}

// ============ ATTENDANCE ============
async function openAttClasses(grade) {
  currentAttGrade = grade;
  goPage('att-classes');
  document.getElementById('att-grade-title').textContent = 'کلاس‌های ' + grade;
  const container = document.getElementById('att-classes-list');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';
  const classes = await getClasses(grade);
  container.innerHTML = '';
  if (classes.length === 0) {
    container.innerHTML = '<div class="empty-state">کلاسی نیست</div>';
    return;
  }
  classes.forEach(cls => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = () => openAttSheet(grade, cls);
    div.innerHTML = `<div class="avatar-mini">${cls.charAt(0)}</div><div class="info"><strong>کلاس ${cls}</strong></div>`;
    container.appendChild(div);
  });
}

async function openAttSheet(grade, className) {
  currentAttGrade = grade;
  currentAttClass = className;
  currentBell = 1;
  goPage('att-sheet');
  document.getElementById('att-sheet-title').textContent = `${grade} - ${className}`;
  await renderBellTabs();
  await renderAttSheet();
}

async function renderBellTabs() {
  const tabs = document.getElementById('bell-tabs');
  const today = new Date().toISOString().slice(0, 10);
  const items = [];
  for (let b = 1; b <= 4; b++) {
    const data = await getAttendance(currentAttGrade, currentAttClass, today, b);
    items.push({ bell: b, approved: !!(data && data.teacherApproved) });
  }
  tabs.innerHTML = '';
  items.forEach(({ bell, approved }) => {
    const div = document.createElement('button');
    div.className = 'bell-tab' + (bell === currentBell ? ' active' : '') + (approved ? ' approved' : '');
    div.textContent = 'زنگ ' + bell;
    div.onclick = () => { currentBell = bell; renderBellTabs(); renderAttSheet(); };
    tabs.appendChild(div);
  });
}

async function renderAttSheet() {
  const container = document.getElementById('att-sheet-container');
  const students = await getClassStudents(currentAttGrade, currentAttClass);
  if (!students || students.length === 0) {
    container.innerHTML = '<div class="empty-state">دانش‌آموزی نیست</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await getAttendance(currentAttGrade, currentAttClass, today, currentBell);
  const isLocked = existing && existing.teacherApproved;

  const data = existing || {
    date: today, bell: currentBell,
    grade: currentAttGrade, className: currentAttClass,
    teacherPhone: currentUser.phone, teacherName: currentUser.name,
    records: students.map(s => ({ phone: s.phone || s.name, name: s.name, status: 'present' })),
    teacherApproved: false, viceReviewed: false,
    createdAt: Date.now()
  };

  container.innerHTML = '';

  if (isLocked) {
    const lock = document.createElement('div');
    lock.style.cssText = 'padding:10px;background:#e8f5e9;color:#2e7d32;border-radius:10px;margin-bottom:10px;font-size:13px;text-align:center;';
    lock.textContent = '✓ این زنگ توسط معلم تأیید شده است' + (existing.viceReviewed ? ' و توسط معاون بازبینی شد' : '');
    container.appendChild(lock);
  }

  students.forEach(s => {
    const key = s.phone || s.name;
    const rec = data.records.find(r => r.phone === key);
    const status = rec ? rec.status : 'present';
    const div = document.createElement('div');
    div.className = 'attend-row';
    div.innerHTML = `
      <span>${s.name}</span>
      <button class="attend-btn ${status === 'present' ? 'present' : 'absent'}"
              data-key="${key}" data-name="${s.name}"
              ${isLocked ? 'disabled' : ''}
              onclick="toggleAttend(this)">${status === 'present' ? '−' : 'غ'}</button>
    `;
    container.appendChild(div);
  });

  if (!isLocked) {
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn submit-green';
    submitBtn.textContent = '✓ تأیید و ارسال';
    submitBtn.onclick = () => submitAttendance(data);
    container.appendChild(submitBtn);
  }
}

function toggleAttend(btn) {
  if (btn.disabled) return;
  const isPresent = btn.classList.contains('present');
  btn.classList.remove('present', 'absent');
  if (isPresent) {
    btn.classList.add('absent');
    btn.textContent = 'غ';
  } else {
    btn.classList.add('present');
    btn.textContent = '−';
  }
}

async function submitAttendance(baseData) {
  const rows = document.querySelectorAll('#att-sheet-container .attend-row .attend-btn');
  const records = [];
  rows.forEach(b => {
    records.push({
      phone: b.dataset.key,
      name: b.dataset.name,
      status: b.classList.contains('present') ? 'present' : 'absent'
    });
  });
  const data = {
    ...baseData,
    records,
    teacherApproved: true,
    teacherPhone: currentUser.phone,
    teacherName: currentUser.name,
    approvedAt: Date.now()
  };
  await saveAttendance(currentAttGrade, currentAttClass, data.date, currentBell, data);
  await renderBellTabs();
  await renderAttSheet();
}

// ============ CREATOR — CLASS MANAGEMENT ============
async function openGradeManage(grade) {
  currentGradeManage = grade;
  goPage('grade-manage');
  document.getElementById('gm-title').textContent = 'مدیریت ' + grade;
  await renderClassesList();
}

async function renderClassesList(silent) {
  const container = document.getElementById('gm-classes');
  if (!silent) container.innerHTML = '<div class="empty-state">بارگذاری...</div>';
  const classes = await getClasses(currentGradeManage);
  container.innerHTML = '';
  if (classes.length === 0) {
    container.innerHTML = '<div class="empty-state">کلاسی نیست</div>';
    return;
  }
  classes.forEach(cls => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.cursor = 'default';
    div.innerHTML = `<div class="avatar-mini">${cls.charAt(0)}</div><div class="info" style="cursor:pointer;" onclick="openClassStudents('${cls}')"><strong>کلاس ${cls}</strong></div>`;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.style.cssText = 'background:#ffebee;color:#c62828;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:16px;';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('حذف کلاس ' + cls + ' و همه دانش‌آموزانش؟')) return;
      await removeClass(currentGradeManage, cls);
      renderClassesList(true);
    };
    div.appendChild(del);
    container.appendChild(div);
  });
}

async function promptAddClass() {
  const name = prompt('نام کلاس (مثلاً A یا ۱):');
  if (!name || !name.trim()) return;
  await addClass(currentGradeManage, name.trim());
  renderClassesList(true);
}

async function openClassStudents(className) {
  currentClassManage = className;
  goPage('class-students');
  document.getElementById('cs-title').textContent = `${currentGradeManage} - ${className}`;
  await renderStudentsList();
}

async function renderStudentsList(silent) {
  const container = document.getElementById('cs-list');
  if (!silent) container.innerHTML = '<div class="empty-state">بارگذاری...</div>';
  const students = await getClassStudents(currentGradeManage, currentClassManage);
  container.innerHTML = '';
  if (!students || students.length === 0) {
    container.innerHTML = '<div class="empty-state">دانش‌آموزی نیست</div>';
    return;
  }
  students.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.cursor = 'default';
    div.innerHTML = `<div class="avatar-mini">${i + 1}</div><div class="info"><strong>${s.name}</strong><small>${s.phone || '—'}</small></div>`;
    const del = document.createElement('button');
    del.textContent = '🗑';
    del.style.cssText = 'background:#ffebee;color:#c62828;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:16px;';
    del.onclick = async () => {
      if (!confirm('حذف ' + s.name + '؟')) return;
      await removeStudent(currentGradeManage, currentClassManage, s.phone || s.name);
      renderStudentsList(true);
    };
    div.appendChild(del);
    container.appendChild(div);
  });
}

function openAddStudent() {
  goPage('add-student');
  document.getElementById('st-name').value = '';
  document.getElementById('st-phone').value = '';
  document.getElementById('st-school').value = currentUser.school || '';
  document.getElementById('st-error').style.display = 'none';
}

async function submitAddStudent() {
  const name = document.getElementById('st-name').value.trim();
  const phone = document.getElementById('st-phone').value.trim();
  const school = document.getElementById('st-school').value.trim();
  const err = document.getElementById('st-error');
  if (!name) { err.style.display = 'block'; err.textContent = 'نام خالی'; return; }
  if (phone && !/^09\d{9}$/.test(phone)) { err.style.display = 'block'; err.textContent = 'شماره نامعتبر'; return; }

  const list = await getClassStudents(currentGradeManage, currentClassManage);
  const key = phone || name;
  if (list.find(s => (s.phone || s.name) === key)) {
    err.style.display = 'block'; err.textContent = 'قبلاً اضافه شده'; return;
  }
  await addStudent(currentGradeManage, currentClassManage, { name, phone, school });
  goPage('class-students');
  await renderStudentsList(true);
}

// ============ WEEKLY ============
async function openWeeklyGrade(grade) {
  currentWeeklyGrade = grade;
  goPage('weekly-classes');
  document.getElementById('wc-title').textContent = 'کلاس‌های ' + grade;
  const container = document.getElementById('wc-list');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';
  const classes = await getClasses(grade);
  container.innerHTML = '';
  if (classes.length === 0) {
    container.innerHTML = '<div class="empty-state">کلاسی نیست</div>';
    return;
  }
  classes.forEach(cls => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.onclick = () => openWeeklyView(grade, cls);
    div.innerHTML = `<div class="avatar-mini">${cls.charAt(0)}</div><div class="info"><strong>کلاس ${cls}</strong></div>`;
    container.appendChild(div);
  });
}

async function openWeeklyView(grade, className) {
  currentWeeklyClass = className;
  goPage('weekly-view');
  document.getElementById('wv-title').textContent = `${grade} - ${className}`;
  const container = document.getElementById('wv-container');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  const keys = await getAllAttendanceKeys(grade, className);
  const weekAgo = Date.now() - 7 * 86400000;

  const studentsMap = {};
  const datesSet = new Set();

  for (const k of keys) {
    const raw = await redisCmd(['GET', k]);
    if (!raw) continue;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data.teacherApproved) continue;
    const ts = data.createdAt || data.approvedAt || 0;
    if (ts < weekAgo) continue;
    const keyDate = data.date + '_' + data.bell;
    datesSet.add(keyDate);
    (data.records || []).forEach(r => {
      if (!studentsMap[r.name]) studentsMap[r.name] = { name: r.name, records: {} };
      studentsMap[r.name].records[keyDate] = r.status;
    });
  }

  container.innerHTML = '';
  if (Object.keys(studentsMap).length === 0) {
    container.innerHTML = '<div class="empty-state">داده‌ای در هفته اخیر نیست</div>';
    return;
  }

  const dateKeys = Array.from(datesSet).sort();
  const students = Object.values(studentsMap);

  const table = document.createElement('div');
  table.style.cssText = 'overflow-x:auto;background:#fff;border-radius:12px;padding:10px;';
  let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f0f7ff;"><th style="padding:8px;border:1px solid #ddd;">نام</th>';
  dateKeys.forEach(k => {
    const [d, b] = k.split('_');
    html += `<th style="padding:8px;border:1px solid #ddd;white-space:nowrap;">${d.slice(5)}<br>زنگ ${b}</th>`;
  });
  html += '</tr></thead><tbody>';
  students.forEach(st => {
    html += `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${st.name}</td>`;
    dateKeys.forEach(k => {
      const st2 = st.records[k] || '—';
      const color = st2 === 'present' ? '#4caf50' : (st2 === 'absent' ? '#f44336' : '#999');
      const label = st2 === 'present' ? '−' : (st2 === 'absent' ? 'غ' : '—');
      html += `<td style="padding:8px;border:1px solid #ddd;text-align:center;color:${color};font-weight:bold;">${label}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  table.innerHTML = html;
  container.appendChild(table);
}

// ============ LOGOUT ============
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}