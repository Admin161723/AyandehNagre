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

const KEY_INDEX       = 'amzyar:users:index';
const KEY_CFG_MANAGER = 'amzyar:config:managerPass';
const KEY_CFG_TEACHER = 'amzyar:config:teacherPass';
const KEY_CFG_CREATOR = 'amzyar:config:creatorPhone';

const userKey = (phone) => `amzyar:user:${phone}`;

async function getUser(phone) {
  try {
    const raw = await redisCmd(['GET', userKey(phone)]);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('getUser error:', e);
    return null;
  }
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
  } catch (e) {
    console.error('getIndexArray error:', e);
    return [];
  }
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

async function getSetting(key) {
  try {
    const val = await redisCmd(['GET', key]);
    return val === null || val === undefined ? '' : String(val);
  } catch (e) {
    console.error('getSetting error:', e);
    return '';
  }
}

async function setSetting(key, value) {
  await redisCmd(['SET', key, String(value)]);
}

async function getManagerPass()  { return getSetting(KEY_CFG_MANAGER); }
async function getTeacherPass()  { return getSetting(KEY_CFG_TEACHER); }
async function getCreatorPhone() { return getSetting(KEY_CFG_CREATOR); }