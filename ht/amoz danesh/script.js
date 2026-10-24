let tempPhone = '';
let tempCode = '';
let tempName = '';
let tempPass = '';
let tempAvatar = '';

window.onload = async function () {
  const codeInput = document.getElementById('code-input');
  ['paste', 'copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach(evt => {
    codeInput.addEventListener(evt, e => e.preventDefault());
  });
  codeInput.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
  });

  const startTime = Date.now();

  const current = localStorage.getItem('currentUser');
  if (current) {
    const user = await getUser(current);
    if (user) {
      if (user.role === 'creator') {
        await loadCreator(user);
        showScreen('creator');
      } else if (user.isManager) {
        await loadManager(user);
        showScreen('manager');
      } else {
        loadMain(user);
        showScreen('main');
      }
      return;
    }
  }

  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, 2000 - elapsed);
  setTimeout(() => showScreen('login'), remaining);
};

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

function initialOf(name) {
  if (!name) return '';
  const t = name.trim();
  return t ? t.charAt(0) : '';
}

async function goLogin() {
  const phone = document.getElementById('phone').value.trim();
  const error = document.getElementById('error-phone');
  const btn = document.getElementById('btn-phone');

  if (!/^09\d{9}$/.test(phone)) {
    error.style.display = 'block';
    error.textContent = 'شماره موبایل معتبر وارد کنید (۱۱ رقم با ۰۹)';
    return;
  }
  error.style.display = 'none';
  tempPhone = phone;

  btn.disabled = true;
  btn.textContent = 'در حال بررسی...';

  try {
    const user = await getUser(phone);
    if (user) {
      document.getElementById('phone-show').textContent = phone;
      document.getElementById('password-input').value = '';
      document.getElementById('error-password').style.display = 'none';
      showScreen('password');
    } else {
      tempCode = Math.floor(1000 + Math.random() * 9000).toString();
      document.getElementById('code-display').textContent = tempCode;
      document.getElementById('code-input').value = '';
      document.getElementById('error-code').style.display = 'none';
      showScreen('verify');
    }
  } catch (e) {
    error.style.display = 'block';
    error.textContent = 'خطا در ارتباط با دیتابیس. اینترنت را بررسی کنید.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'ادامه';
  }
}

async function doLogin() {
  const pass = document.getElementById('password-input').value;
  const error = document.getElementById('error-password');
  const btn = document.getElementById('btn-password');

  if (!pass) {
    error.style.display = 'block';
    error.textContent = 'رمز عبور را وارد کنید';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'در حال ورود...';

  try {
    const user = await getUser(tempPhone);
    if (user && user.password === pass) {
      localStorage.setItem('currentUser', tempPhone);
      if (user.role === 'creator') {
        await loadCreator(user);
        showScreen('creator');
      } else if (user.isManager) {
        await loadManager(user);
        showScreen('manager');
      } else {
        loadMain(user);
        showScreen('main');
      }
    } else {
      error.style.display = 'block';
      error.textContent = 'رمز عبور اشتباه است';
    }
  } catch (e) {
    error.style.display = 'block';
    error.textContent = 'خطا در ارتباط با دیتابیس';
  } finally {
    btn.disabled = false;
    btn.textContent = 'تأیید و ورود';
  }
}

function verifyCode() {
  const code = document.getElementById('code-input').value.trim();
  const error = document.getElementById('error-code');
  if (code === tempCode) {
    error.style.display = 'none';
    showScreen('profile');
  } else {
    error.style.display = 'block';
    error.textContent = 'کد وارد شده اشتباه است';
  }
}

function previewAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    tempAvatar = ev.target.result;
    const av = document.getElementById('avatar-preview');
    av.style.backgroundImage = `url(${tempAvatar})`;
    av.innerHTML = '';
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  const name = document.getElementById('name-input').value.trim();
  const pass1 = document.getElementById('pass1').value;
  const pass2 = document.getElementById('pass2').value;
  const error = document.getElementById('error-profile');

  if (!name) { error.style.display = 'block'; error.textContent = 'نام را وارد کنید'; return; }
  if (pass1.length < 6) { error.style.display = 'block'; error.textContent = 'رمز عبور حداقل ۶ کاراکتر باشد'; return; }
  if (pass1 !== pass2) { error.style.display = 'block'; error.textContent = 'رمز عبور و تکرار آن یکسان نیست'; return; }

  tempName = name;
  tempPass = pass1;
  error.style.display = 'none';
  showScreen('school');
}

function toggleManager() {
  const checked = document.getElementById('is-manager').checked;
  document.getElementById('manager-box').style.display = checked ? 'block' : 'none';
  document.getElementById('school-fields').style.display = checked ? 'none' : 'block';
}

function toggleTeacher() {
  document.getElementById('teacher-box').style.display =
    document.getElementById('is-teacher').checked ? 'block' : 'none';
}

async function finishRegister() {
  const isManager = document.getElementById('is-manager').checked;
  const isTeacher = document.getElementById('is-teacher').checked;
  const managerPassInput = document.getElementById('manager-pass').value.trim();
  const teacherPassInput = document.getElementById('teacher-pass').value.trim();

  const error = document.getElementById('error-school');
  const btn = document.getElementById('btn-finish');
  error.style.display = 'none';

  btn.disabled = true;
  btn.textContent = 'در حال بررسی...';

  try {
    // ===== مسیر مدیر =====
    if (isManager) {
      const correctMgr = await getManagerPass();
      if (!correctMgr || managerPassInput !== correctMgr) {
        error.style.display = 'block';
        error.textContent = 'رمز مدیر اشتباه است';
        return;
      }

      if (isTeacher) {
        const correctTch = await getTeacherPass();
        if (!correctTch || teacherPassInput !== correctTch) {
          error.style.display = 'block';
          error.textContent = 'رمز معلم اشتباه است';
          return;
        }
      }

      const existing = await getUser(tempPhone);
      if (existing) {
        error.style.display = 'block';
        error.textContent = 'این شماره قبلاً ثبت‌نام کرده';
        return;
      }

      localStorage.setItem('pendingManager', JSON.stringify({
        phone: tempPhone,
        name: tempName,
        password: tempPass,
        avatar: tempAvatar || '',
        isTeacher: isTeacher,
        createdAt: Date.now()
      }));

      window.location.href = 'panleamoz.html';
      return;
    }

    // ===== مسیر معلم / دانش‌آموز =====
    const province = document.getElementById('province').value.trim();
    const school = document.getElementById('school').value.trim();
    const grade = document.getElementById('grade').value.trim();

    if (isTeacher) {
      const correctTch = await getTeacherPass();
      if (!correctTch || teacherPassInput !== correctTch) {
        error.style.display = 'block';
        error.textContent = 'رمز معلم اشتباه است';
        return;
      }
    }

    if (!province || !school || !grade) {
      error.style.display = 'block';
      error.textContent = 'همه فیلدها را پر کنید';
      return;
    }

    const existing = await getUser(tempPhone);
    if (existing) {
      error.style.display = 'block';
      error.textContent = 'این شماره قبلاً ثبت‌نام کرده';
      return;
    }

    btn.textContent = 'در حال ذخیره...';

    const newUser = {
      name: tempName,
      password: tempPass,
      avatar: tempAvatar || '',
      province: province,
      school: school,
      grade: grade,
      isManager: false,
      isTeacher: isTeacher,
      role: 'user',
      createdAt: Date.now()
    };

    await saveUser(tempPhone, newUser);
    localStorage.setItem('currentUser', tempPhone);
    loadMain(newUser);
    showScreen('main');

  } catch (e) {
    error.style.display = 'block';
    error.textContent = 'خطا در ذخیره اطلاعات. دوباره امتحان کنید.';
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'تأیید و ورود';
  }
}

function loadMain(user) {
  document.getElementById('main-name').textContent = user.name || 'کاربر';
  const parts = [];
  if (user.isTeacher) parts.push('معلم');
  if (user.school) parts.push(user.school);
  if (user.grade) parts.push(user.grade);
  document.getElementById('main-info').textContent = parts.join(' | ') || 'آموزیار';

  const av = document.getElementById('main-avatar');
  if (user.avatar) {
    av.style.backgroundImage = `url(${user.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(user.name);
  }
}

async function loadManager(user) {
  document.getElementById('manager-name').textContent = user.name || 'مدیر';
  const infoParts = [];
  if (user.school) infoParts.push(user.school);
  if (user.city) infoParts.push(user.city);
  else if (user.province) infoParts.push(user.province);
  if (user.district) infoParts.push(user.district);
  document.getElementById('manager-info').textContent = infoParts.join(' | ');

  const av = document.getElementById('manager-avatar');
  if (user.avatar) {
    av.style.backgroundImage = `url(${user.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initialOf(user.name);
  }

  try {
    const all = await getAllUsers();
    const sameSchool = all.filter(u => u.school === user.school && u.school);
    document.getElementById('mgr-students').textContent =
      sameSchool.filter(u => !u.isTeacher && !u.isManager && u.role !== 'creator').length;
    document.getElementById('mgr-teachers').textContent =
      sameSchool.filter(u => u.isTeacher).length;
    document.getElementById('mgr-classes').textContent =
      new Set(sameSchool.map(u => u.grade).filter(Boolean)).size;
  } catch (e) { console.error(e); }
}

async function loadCreator(user) {
  document.getElementById('creator-name').textContent = user.name || 'سازنده';

  const av = document.getElementById('creator-avatar');
  if (user.avatar) {
    av.style.backgroundImage = `url(${user.avatar})`;
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = 'س';
  }

  const list = document.getElementById('user-list');
  list.innerHTML = '<p style="color:#999; font-size:13px;">در حال بارگذاری...</p>';

  try {
    const all = await getAllUsers();
    document.getElementById('cr-total').textContent = all.length;
    document.getElementById('cr-managers').textContent = all.filter(u => u.isManager).length;
    document.getElementById('cr-teachers').textContent = all.filter(u => u.isTeacher).length;

    list.innerHTML = '';
    if (all.length === 0) {
      list.innerHTML = '<p style="color:#999; font-size:13px;">کاربری یافت نشد</p>';
      return;
    }

    all.sort((a, b) => {
      const w = u => u.role === 'creator' ? 0 : u.isManager ? 1 : u.isTeacher ? 2 : 3;
      return w(a) - w(b);
    });

    all.forEach(u => {
      const row = document.createElement('div');
      row.className = 'user-row';
      const tag = u.role === 'creator' ? ' [سازنده]' :
                  u.isManager ? ' [مدیر]' :
                  u.isTeacher ? ' [معلم]' : '';
      row.innerHTML = `
        <strong>${(u.name || 'بدون نام') + tag}</strong>
        <span>${u.phone}</span>
      `;
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<p style="color:#e53935; font-size:13px;">خطا در بارگذاری</p>';
    console.error(e);
  }
}

function logout() {
  localStorage.removeItem('currentUser');
  document.getElementById('phone').value = '';
  document.getElementById('password-input').value = '';
  document.getElementById('code-input').value = '';
  document.getElementById('name-input').value = '';
  document.getElementById('pass1').value = '';
  document.getElementById('pass2').value = '';
  document.getElementById('province').value = '';
  document.getElementById('school').value = '';
  document.getElementById('grade').value = '';
  document.getElementById('is-manager').checked = false;
  document.getElementById('manager-pass').value = '';
  document.getElementById('manager-box').style.display = 'none';
  document.getElementById('school-fields').style.display = 'block';
  document.getElementById('is-teacher').checked = false;
  document.getElementById('teacher-pass').value = '';
  document.getElementById('teacher-box').style.display = 'none';
  document.getElementById('code-display').textContent = '----';
  const av = document.getElementById('avatar-preview');
  av.style.backgroundImage = '';
  av.innerHTML = '<span>انتخاب عکس</span>';
  tempPhone = ''; tempCode = ''; tempName = ''; tempPass = ''; tempAvatar = '';
  showScreen('login');
}