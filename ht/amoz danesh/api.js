// ============================================================
// api.js — نسخه نهایی (Upstash + همه توابع قبلی)
// ============================================================
const UPSTASH_URL = 'https://precious-silkworm-238577.upstash.io';
const UPSTASH_TOKEN = 'gQAAAAAAA6PxAAIgcDI4MzhmMmNmZWIyNjk0NTVjOTFhN2MyMWFkYTVlZGY2OQ';

async function redisCmd(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// ============ USERS ============
const KEY_INDEX = 'amzyar:users:index';
const userKey = (phone) => `amzyar:user:${phone}`;

async function getUser(phone) {
  try {
    const raw = await redisCmd(['GET', userKey(phone)]);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) { return null; }
}

async function saveUser(phone, user) {
  await redisCmd(['SET', userKey(phone), JSON.stringify(user)]);
  await addToIndex(phone);
}

async function deleteUser(phone) {
  await redisCmd(['DEL', userKey(phone)]);
  await removeFromIndex(phone);
}

async function getIndexArray() {
  try {
    const raw = await redisCmd(['GET', KEY_INDEX]);
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) { return []; }
}

async function setIndexArray(arr) {
  await redisCmd(['SET', KEY_INDEX, JSON.stringify(arr)]);
}

async function addToIndex(phone) {
  const arr = await getIndexArray();
  if (!arr.includes(phone)) {
    arr.push(phone);
    await setIndexArray(arr);
  }
}

async function removeFromIndex(phone) {
  const arr = await getIndexArray();
  await setIndexArray(arr.filter(p => p !== phone));
}

async function getAllUsers() {
  const phones = await getIndexArray();
  const users = [];
  for (const p of phones) {
    const u = await getUser(p);
    if (u) users.push({ phone: p, ...u });
  }
  return users;
}

// ============ SETTINGS ============
async function getSetting(key) {
  try {
    const val = await redisCmd(['GET', key]);
    return val === null || val === undefined ? '' : String(val);
  } catch (e) { return ''; }
}

async function setSetting(key, value) {
  await redisCmd(['SET', key, String(value)]);
}

async function getManagerPass()  { return getSetting('amzyar:config:managerPass'); }
async function getTeacherPass()  { return getSetting('amzyar:config:teacherPass'); }
async function getVicePass()     { return getSetting('amzyar:config:vicePass'); }
async function getSupportPhone() { return getSetting('amzyar:config:supportPhone'); }

// aliases برای سازگاری با amoz.js
async function getMainSupportPhone() { return getSupportPhone(); }
async function setMainSupportPhone(p) { await setSetting('amzyar:config:supportPhone', p); }

// ============ AUTH ============
async function requestSignupCode(phone) {
  if (!/^09\d{9}$/.test(phone)) return { ok: false, error: 'شماره نامعتبر' };
  if (await getUser(phone)) return { ok: false, error: 'قبلاً ثبت شده' };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redisCmd(['SET', `amzyar:code:${phone}`, code, 'EX', 120]);
  return { ok: true, code };
}

async function verifySignupCode(phone, code) {
  const saved = await redisCmd(['GET', `amzyar:code:${phone}`]);
  return String(saved).trim() === String(code).trim();
}

async function registerUser(data) {
  const { phone, code } = data;
  if (!/^09\d{9}$/.test(phone)) return { ok: false, error: 'شماره نامعتبر' };
  if (!data.password || data.password.length < 6) return { ok: false, error: 'رمز حداقل ۶' };
  if (!(await verifySignupCode(phone, code))) return { ok: false, error: 'کد تأیید اشتباه' };
  if (await getUser(phone)) return { ok: false, error: 'تکراری' };
  const user = {
    phone,
    name: data.name || '',
    password: data.password,
    avatar: data.avatar || '',
    province: data.province || '',
    city: data.city || '',
    school: data.school || '',
    grade: data.grade || '',
    isManager: false,
    isTeacher: false,
    isVice: false,
    role: 'user',
    bannedUntil: null,
    createdAt: Date.now()
  };
  await saveUser(phone, user);
  await redisCmd(['DEL', `amzyar:code:${phone}`]);
  return { ok: true, user };
}

async function loginUser(phone, password) {
  if (!/^09\d{9}$/.test(phone)) return { ok: false, error: 'شماره نامعتبر' };
  const u = await getUser(phone);
  if (!u) return { ok: false, error: 'کاربر یافت نشد' };
  if (u.password !== password) return { ok: false, error: 'رمز اشتباه' };
  if (u.bannedUntil && u.bannedUntil > Date.now()) return { ok: false, error: 'حساب مسدود است' };
  return { ok: true, user: u };
}

// ============ CHAT ============
function chatKey(a, b) {
  const s = [a, b].sort();
  return `amzyar:chat:${s[0]}:${s[1]}`;
}

async function getChatBetween(a, b) {
  const raw = await redisCmd(['GET', chatKey(a, b)]);
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveChatBetween(a, b, msgs) {
  await redisCmd(['SET', chatKey(a, b), JSON.stringify(msgs)]);
}

async function sendMsg(fromPhone, toPhone, type, content) {
  const msgs = await getChatBetween(fromPhone, toPhone);
  msgs.push({ from: fromPhone, type, content, ts: Date.now() });
  await saveChatBetween(fromPhone, toPhone, msgs);
  await addContact(toPhone, fromPhone);
  await addContact(fromPhone, toPhone);
}

async function deleteChatBetween(a, b) {
  await saveChatBetween(a, b, []);
  await removeContact(a, b);
  await removeContact(b, a);
}

// ============ CONTACTS ============
async function getContacts(ownerPhone) {
  const raw = await redisCmd(['GET', `amzyar:contacts:${ownerPhone}`]);
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function addContact(ownerPhone, contactPhone) {
  if (ownerPhone === contactPhone) return;
  const c = await getContacts(ownerPhone);
  if (!c.includes(contactPhone)) {
    c.push(contactPhone);
    await redisCmd(['SET', `amzyar:contacts:${ownerPhone}`, JSON.stringify(c)]);
  }
}

async function removeContact(ownerPhone, contactPhone) {
  const c = await getContacts(ownerPhone);
  const nc = c.filter(x => x !== contactPhone);
  await redisCmd(['SET', `amzyar:contacts:${ownerPhone}`, JSON.stringify(nc)]);
}

// ============ CLASSES ============
async function getClasses(grade) {
  const raw = await redisCmd(['GET', `amzyar:classes:${grade}`]);
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveClasses(grade, arr) {
  await redisCmd(['SET', `amzyar:classes:${grade}`, JSON.stringify(arr)]);
}

async function addClass(grade, name) {
  const list = await getClasses(grade);
  if (!list.includes(name)) {
    list.push(name);
    await saveClasses(grade, list);
  }
}

async function removeClass(grade, name) {
  const list = (await getClasses(grade)).filter(x => x !== name);
  await saveClasses(grade, list);
  await redisCmd(['DEL', `amzyar:class:${grade}:${name}`]);
}

async function getClassStudents(grade, cn) {
  const raw = await redisCmd(['GET', `amzyar:class:${grade}:${cn}`]);
  if (!raw) return [];
  const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return d.students || [];
}

async function saveClassStudents(grade, cn, students) {
  await redisCmd(['SET', `amzyar:class:${grade}:${cn}`, JSON.stringify({ students })]);
}

async function addStudent(grade, cn, st) {
  const list = await getClassStudents(grade, cn);
  list.push(st);
  await saveClassStudents(grade, cn, list);
}

async function removeStudent(grade, cn, phone) {
  const list = (await getClassStudents(grade, cn)).filter(s => s.phone !== phone);
  await saveClassStudents(grade, cn, list);
}

// ============ ATTENDANCE ============
function attKey(grade, cn, date, bell) {
  return `amzyar:att:${grade}:${cn}:${date}:${bell}`;
}
function attIndexKey(grade, cn) {
  return `amzyar:att:index:${grade}:${cn}`;
}

async function getAttendance(grade, cn, date, bell) {
  const raw = await redisCmd(['GET', attKey(grade, cn, date, bell)]);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveAttendance(grade, cn, date, bell, data) {
  await redisCmd(['SET', attKey(grade, cn, date, bell), JSON.stringify(data)]);

  // آپدیت ایندکس (برای بازیابی سریع در هفتگی)
  const ik = attIndexKey(grade, cn);
  const raw = await redisCmd(['GET', ik]);
  let arr = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  if (!arr.find(x => x.date === date && x.bell === bell)) {
    arr.push({ date, bell, ts: Date.now() });
    await redisCmd(['SET', ik, JSON.stringify(arr)]);
  }
}

async function getAllAttendanceKeys(grade, cn) {
  const raw = await redisCmd(['GET', attIndexKey(grade, cn)]);
  if (!raw) return [];
  const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return arr.map(x => attKey(grade, cn, x.date, x.bell));
}