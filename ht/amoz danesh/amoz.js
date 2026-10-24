let currentUser = null;
let currentChatPhone = null;
let currentEditPhone = null;
let currentListType = '';
let currentAttGrade = '';
let currentAttClass = '';

// ============ API اضافی ============
async function getChat(p) {
  const raw = await redisCmd(['GET', `amzyar:chat:${p}`]);
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
async function saveChat(p, m) { await redisCmd(['SET', `amzyar:chat:${p}`, JSON.stringify(m)]); }
async function sendMessage(p, from, type, content) {
  const m = await getChat(p);
  m.push({ from, type, content, ts: Date.now(), delU: false, delS: false });
  await saveChat(p, m);
  if (from === 'user') await addSupportContact(p);
}
async function deleteChatBothSides(p) {
  const m = await getChat(p);
  m.forEach(x => { x.delU = true; x.delS = true; });
  await saveChat(p, m);
}
async function getSupportContacts() {
  const raw = await redisCmd(['GET', 'amzyar:support:contacts']);
  let phones = raw ? JSON.parse(raw) : [];
  const all = await getAllUsers();
  all.forEach(u => {
    if (u.isManager || u.isVice || u.role === 'creator') {
      if (!phones.includes(u.phone)) phones.push(u.phone);
    }
  });
  const c = [];
  for (const p of phones) { const u = await getUser(p); if (u) c.push({ phone: p, ...u }); }
  return c;
}
async function addSupportContact(p) {
  const raw = await redisCmd(['GET', 'amzyar:support:contacts']);
  const phones = raw ? JSON.parse(raw) : [];
  if (!phones.includes(p)) { phones.push(p); await redisCmd(['SET', 'amzyar:support:contacts', JSON.stringify(phones)]); }
}
async function getClasses(grade) {
  const raw = await redisCmd(['GET', `amzyar:classes:${grade}`]);
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
async function getClassStudents(grade, cn) {
  const raw = await redisCmd(['GET', `amzyar:class:${grade}:${cn}`]);
  if (!raw) return [];
  const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return d.students || [];
}
async function saveAttendance(grade, cn, data) {
  await redisCmd(['SET', `amzyar:attendance:${grade}:${cn}:${data.date}`, JSON.stringify(data)]);
}
async function getAttendance(grade, cn, date) {
  const raw = await redisCmd(['GET', `amzyar:attendance:${grade}:${cn}:${date}`]);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
async function banUser(p, days) {
  const u = await getUser(p);
  if (!u) return;
  u.bannedUntil = Date.now() + (days * 86400000);
  await saveUser(p, u);
}
async function unbanUser(p) {
  const u = await getUser(p);
  if (!u) return;
  u.bannedUntil = null;
  await saveUser(p, u);
}

// ============ شروع ============
window.onload = async function () {
  const cur = localStorage.getItem('currentUser');
  if (!cur) { window.location.href = 'index.html'; return; }
  const u = await getUser(cur);
  if (!u) { window.location.href = 'index.html'; return; }
  if (u.bannedUntil && u.bannedUntil > Date.now()) {
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
  if (name === 'messages') loadMessages();
  if (name === 'settings') loadSettings();
  if (name === 'panel') loadPanel();
  if (name === 'edit-profile') fillEditProfile();
}

function initialOf(n) { return n ? n.trim().charAt(0) : ''; }

function tickHtml(u) {
  if (!u) return '';
  if (u.role === 'creator') return '<span class="tick tick-black">✓</span>';
  if (u.role === 'support') return '<span class="tick tick-blue">✓</span>';
  if (u.isManager || u.isVice) return '<span class="tick tick-green">✓</span>';
  if (u.bannedUntil && u.bannedUntil > Date.now()) return '<span class="tick tick-red">!</span>';
  return '';
}

function hasPanelAccess(u) {
  return u.role === 'creator' || u.role === 'support' || u.isManager || u.isVice || u.isTeacher;
}

function isStaff(u) {
  return u.role === 'support' || u.isManager || u.isVice || u.role === 'creator';
}

// ============ خانه ============
function loadHome() {
  document.getElementById('home-name').innerHTML =
    (currentUser.name || 'کاربر') + ' ' + tickHtml(currentUser);

  const p = [];
  if (currentUser.isManager) p.push('مدیر');
  else if (currentUser.isVice) p.push('معاون');
  else if (currentUser.isTeacher) p.push('معلم');
  if (currentUser.city || currentUser.province) p.push(currentUser.city || currentUser.province);
  if (currentUser.school) p.push(currentUser.school);
  if (currentUser.grade) p.push(currentUser.grade);
  document.getElementById('home-info').textContent = p.join(' | ') || 'آموزیار';

  const av = document.getElementById('home-avatar');
  if (currentUser.avatar) {
    av.style.backgroundImage = `url(${currentUser.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(currentUser.name);
  }
}

// ============ تنظیمات ============
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

// ============ ویرایش پروفایل ============
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

// ============ پیام‌ها ============
async function loadMessages() {
  const container = document.getElementById('messages-list');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  try {
    if (isStaff(currentUser)) {
      const contacts = await getSupportContacts();
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
          : `<div class="avatar-mini">${initialOf(c.name)}</div>`;
        div.innerHTML = `${av}<div class="info"><strong>${c.name || 'بدون نام'} ${tickHtml(c)}</strong><small>${c.phone}</small></div>`;
        container.appendChild(div);
      });
    } else {
      const sp = await getSupportPhone();
      if (!sp) { container.innerHTML = '<div class="empty-state">پشتیبانی تنظیم نشده</div>'; return; }
      const sup = await getUser(sp);
      container.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'list-item';
      div.onclick = () => openChat(sp);
      const av = (sup && sup.avatar)
        ? `<div class="avatar-mini" style="background-image:url(${sup.avatar})"></div>`
        : `<div class="avatar-mini">پ</div>`;
      div.innerHTML = `${av}<div class="info"><strong>پشتیبانی ${tickHtml(sup)}</strong><small>پاسخگوی شما</small></div>`;
      container.appendChild(div);
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state">خطا</div>';
  }
}

async function openChat(contactPhone) {
  currentChatPhone = contactPhone;
  goPage('chat');

  const contact = await getUser(contactPhone);
  document.getElementById('chat-name').textContent = (contact && contact.name) || 'گفتگو';
  document.getElementById('chat-sub').textContent = contactPhone;

  const av = document.getElementById('chat-avatar');
  if (contact && contact.avatar) {
    av.style.backgroundImage = `url(${contact.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(contact ? contact.name : 'گ');
  }

  const staff = isStaff(currentUser);
  const userPhoneForChat = staff ? contactPhone : currentUser.phone;
  const messages = await getChat(userPhoneForChat);
  const visible = messages.filter(m => staff ? !m.delS : !m.delU);

  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  visible.forEach(m => {
    const div = document.createElement('div');
    const mine = (staff && m.from === 'staff') || (!staff && m.from === 'user');
    div.className = 'chat-msg ' + (mine ? 'mine' : 'theirs');
    if (m.type === 'image') {
      div.innerHTML = `<img src="${m.content}"><small>${new Date(m.ts).toLocaleTimeString('fa-IR')}</small>`;
    } else {
      div.innerHTML = `${m.content}<small>${new Date(m.ts).toLocaleTimeString('fa-IR')}</small>`;
    }
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendChatText() {
  const input = document.getElementById('chat-input');
  const txt = input.value.trim();
  if (!txt) return;
  input.value = '';
  const staff = isStaff(currentUser);
  const from = staff ? 'staff' : 'user';
  const userPhoneForChat = staff ? currentChatPhone : currentUser.phone;
  await sendMessage(userPhoneForChat, from, 'text', txt);
  openChat(currentChatPhone);
}

async function deleteCurrentChat() {
  if (!confirm('حذف گفتگو؟')) return;
  const staff = isStaff(currentUser);
  const userPhoneForChat = staff ? currentChatPhone : currentUser.phone;
  await deleteChatBothSides(userPhoneForChat);
  openChat(currentChatPhone);
}

// ============ پنل ============
function loadPanel() {
  const menu = document.getElementById('panel-menu');
  menu.innerHTML = '';
  const items = [];

  const isCreator = currentUser.role === 'creator';
  const isSupport = currentUser.role === 'support';
  const isManager = currentUser.isManager;
  const isVice = currentUser.isVice;
  const isTeacher = currentUser.isTeacher;

  if (isCreator || isManager) {
    items.push({ label: 'لیست معلم‌ها', action: () => openList('teacher') });
    items.push({ label: 'لیست معاون‌ها', action: () => openList('vice') });
  }
  if (isCreator) {
    items.push({ label: 'لیست مدیرها', action: () => openList('manager') });
  }
  if (isCreator || isManager || isSupport) {
    items.push({ label: 'لیست کاربران', action: () => openList('user') });
  }
  if (isCreator || isManager || isVice || isTeacher) {
    items.push({ label: 'حضور و غیاب', action: () => goPage('att-grades') });
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

async function openList(type) {
  currentListType = type;
  goPage('list');

  const titles = {
    teacher: 'لیست معلم‌ها',
    vice: 'لیست معاون‌ها',
    manager: 'لیست مدیرها',
    user: 'لیست کاربران'
  };
  document.getElementById('list-title').textContent = titles[type] || 'لیست';

  const canAdd = (currentUser.role === 'creator' || currentUser.isManager) && type !== 'user';
  document.getElementById('list-add-btn').style.display = canAdd ? 'block' : 'none';

  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  try {
    let users = await getAllUsers();
    if (type === 'teacher') users = users.filter(u => u.isTeacher);
    else if (type === 'vice') users = users.filter(u => u.isVice);
    else if (type === 'manager') users = users.filter(u => u.isManager);
    else if (type === 'user') users = users.filter(u => u.role !== 'creator' && u.role !== 'support');

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
    container.innerHTML = '<div class="empty-state">خطا</div>';
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
  document.getElementById('eu-error').style.display = 'none';
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
  await saveUser(currentEditPhone, u);
  openList(currentListType);
}

async function banAction() {
  if (!confirm('بن ۷ روز؟')) return;
  await banUser(currentEditPhone, 7);
  openList(currentListType);
}

async function unbanAction() {
  await unbanUser(currentEditPhone);
  openList(currentListType);
}

async function deleteAction() {
  if (!confirm('حذف دائمی؟')) return;
  await deleteUser(currentEditPhone);
  openList(currentListType);
}

function openAddPerson() {
  goPage('add-person');
  const titles = { teacher: 'افزودن معلم', vice: 'افزودن معاون', manager: 'افزودن مدیر' };
  document.getElementById('add-title').textContent = titles[currentListType] || 'افزودن';
  document.getElementById('add-name').value = '';
  document.getElementById('add-phone').value = '';
  document.getElementById('add-pass').value = '';
  document.getElementById('add-error').style.display = 'none';
}

async function submitAddPerson() {
  const n = document.getElementById('add-name').value.trim();
  const ph = document.getElementById('add-phone').value.trim();
  const pw = document.getElementById('add-pass').value;
  const err = document.getElementById('add-error');
  if (!n) { err.style.display = 'block'; err.textContent = 'نام خالی'; return; }
  if (!/^09\d{9}$/.test(ph)) { err.style.display = 'block'; err.textContent = 'شماره نامعتبر'; return; }
  if (pw.length < 6) { err.style.display = 'block'; err.textContent = 'رمز حداقل ۶'; return; }
  const ex = await getUser(ph);
  if (ex) { err.style.display = 'block'; err.textContent = 'شماره تکراری'; return; }
  const newU = {
    name: n, password: pw, avatar: '',
    province: currentUser.province || '',
    school: currentUser.school || '',
    city: currentUser.city || '',
    grade: '',
    isManager: currentListType === 'manager',
    isTeacher: currentListType === 'teacher',
    isVice: currentListType === 'vice',
    role: 'user',
    bannedUntil: null,
    createdAt: Date.now()
  };
  await saveUser(ph, newU);
  openList(currentListType);
}

// ============ حضور و غیاب ============
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
  goPage('att-sheet');
  document.getElementById('att-sheet-title').textContent = `${grade} - ${className}`;
  const container = document.getElementById('att-sheet-container');
  container.innerHTML = '<div class="empty-state">بارگذاری...</div>';

  const students = await getClassStudents(grade, className);
  if (students.length === 0) {
    container.innerHTML = '<div class="empty-state">دانش‌آموزی نیست</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await getAttendance(grade, className, today);
  const attData = existing || { date: today, records: [] };

  container.innerHTML = '';
  students.forEach(s => {
    const rec = attData.records.find(r => r.phone === s.phone);
    const status = rec ? rec.status : 'present';
    const div = document.createElement('div');
    div.className = 'attend-row';
    div.innerHTML = `
      <span>${s.name}</span>
      <button class="attend-btn ${status === 'present' ? 'present' : 'absent'}"
              data-phone="${s.phone}" data-name="${s.name}"
              onclick="toggleAttend(this)">${status === 'present' ? '-' : 'غ'}</button>
    `;
    container.appendChild(div);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn submit-green';
  submitBtn.textContent = 'تأیید و ارسال';
  submitBtn.onclick = submitAttendance;
  container.appendChild(submitBtn);
}

function toggleAttend(btn) {
  const cur = btn.classList.contains('present') ? 'present' : 'absent';
  const next = cur === 'present' ? 'absent' : 'present';
  btn.classList.remove('present', 'absent');
  btn.classList.add(next);
  btn.textContent = next === 'present' ? '-' : 'غ';
}

async function submitAttendance() {
  const rows = document.querySelectorAll('#att-sheet-container .attend-row .attend-btn');
  const records = [];
  rows.forEach(b => {
    records.push({
      phone: b.dataset.phone,
      name: b.dataset.name,
      status: b.classList.contains('present') ? 'present' : 'absent'
    });
  });
  const data = {
    date: new Date().toISOString().slice(0, 10),
    grade: currentAttGrade,
    className: currentAttClass,
    teacherPhone: currentUser.phone,
    teacherName: currentUser.name,
    records,
    teacherApproved: true,
    viceReviewed: false,
    vicePhone: null,
    createdAt: Date.now()
  };
  await saveAttendance(currentAttGrade, currentAttClass, data);
  alert('ثبت شد');
  goPage('panel');
}

// ============ خروج ============
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}