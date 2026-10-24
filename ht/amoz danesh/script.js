let tempPhone = '';
let tempCode = '';
let tempName = '';
let tempPass = '';
let tempAvatar = '';

window.onload = async function () {
  const ci = document.getElementById('code-input');
  ['paste','copy','cut','contextmenu','selectstart','dragstart'].forEach(evt => {
    ci.addEventListener(evt, e => e.preventDefault());
  });
  ci.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
  });

  const startTime = Date.now();
  const cur = localStorage.getItem('currentUser');
  if (cur) {
    const u = await getUser(cur);
    if (u) {
      if (u.bannedUntil && u.bannedUntil > Date.now()) {
        localStorage.removeItem('currentUser');
      } else {
        window.location.href = encodeURI('safe asli amoz.html');
        return;
      }
    }
  }
  const elapsed = Date.now() - startTime;
  setTimeout(() => showScreen('login'), Math.max(0, 2000 - elapsed));
};

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

async function goLogin() {
  const phone = document.getElementById('phone').value.trim();
  const err = document.getElementById('error-phone');
  const btn = document.getElementById('btn-phone');

  if (!/^09\d{9}$/.test(phone)) {
    err.style.display = 'block';
    err.textContent = 'شماره معتبر وارد کنید';
    return;
  }
  err.style.display = 'none';
  tempPhone = phone;
  btn.disabled = true;
  btn.textContent = 'بررسی...';

  try {
    const u = await getUser(phone);
    if (u) {
      if (u.bannedUntil && u.bannedUntil > Date.now()) {
        const d = new Date(u.bannedUntil).toLocaleDateString('fa-IR');
        err.style.display = 'block';
        err.textContent = 'حساب شما تا ' + d + ' مسدود است';
        return;
      }
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
    err.style.display = 'block';
    err.textContent = 'خطا در اتصال';
  } finally {
    btn.disabled = false;
    btn.textContent = 'ادامه';
  }
}

async function doLogin() {
  const pass = document.getElementById('password-input').value;
  const err = document.getElementById('error-password');
  const btn = document.getElementById('btn-password');

  if (!pass) {
    err.style.display = 'block';
    err.textContent = 'رمز را وارد کنید';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'ورود...';

  try {
    let u = await getUser(tempPhone);

    if (u && u.bannedUntil && u.bannedUntil <= Date.now()) {
      u.bannedUntil = null;
      await saveUser(tempPhone, u);
    }

    if (u && u.bannedUntil && u.bannedUntil > Date.now()) {
      err.style.display = 'block';
      err.textContent = 'حساب مسدود است';
      return;
    }

    if (u && u.password === pass) {
      localStorage.setItem('currentUser', tempPhone);
      window.location.href = encodeURI('safe asli amoz.html');
    } else {
      err.style.display = 'block';
      err.textContent = 'رمز اشتباه است';
    }
  } catch (e) {
    err.style.display = 'block';
    err.textContent = 'خطا';
  } finally {
    btn.disabled = false;
    btn.textContent = 'تأیید و ورود';
  }
}

function verifyCode() {
  const c = document.getElementById('code-input').value.trim();
  const e = document.getElementById('error-code');
  if (c === tempCode) {
    e.style.display = 'none';
    showScreen('profile');
  } else {
    e.style.display = 'block';
    e.textContent = 'کد اشتباه';
  }
}

function previewAvatar(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    tempAvatar = ev.target.result;
    const av = document.getElementById('avatar-preview');
    av.style.backgroundImage = `url(${tempAvatar})`;
    av.innerHTML = '';
  };
  r.readAsDataURL(f);
}

function saveProfile() {
  const n = document.getElementById('name-input').value.trim();
  const p1 = document.getElementById('pass1').value;
  const p2 = document.getElementById('pass2').value;
  const err = document.getElementById('error-profile');

  if (!n) { err.style.display = 'block'; err.textContent = 'نام را وارد کنید'; return; }
  if (p1.length < 6) { err.style.display = 'block'; err.textContent = 'رمز حداقل ۶ کاراکتر'; return; }
  if (p1 !== p2) { err.style.display = 'block'; err.textContent = 'رمز یکسان نیست'; return; }

  tempName = n;
  tempPass = p1;
  err.style.display = 'none';
  showScreen('school');
}

function toggleManager() {
  const c = document.getElementById('is-manager').checked;
  document.getElementById('manager-box').style.display = c ? 'block' : 'none';
  document.getElementById('school-fields').style.display = c ? 'none' : 'block';
}

function toggleTeacher() {
  document.getElementById('teacher-box').style.display =
    document.getElementById('is-teacher').checked ? 'block' : 'none';
}

function toggleVice() {
  document.getElementById('vice-box').style.display =
    document.getElementById('is-vice').checked ? 'block' : 'none';
}

async function finishRegister() {
  const isMgr = document.getElementById('is-manager').checked;
  const isTch = document.getElementById('is-teacher').checked;
  const isVic = document.getElementById('is-vice').checked;
  const err = document.getElementById('error-school');
  const btn = document.getElementById('btn-finish');

  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'بررسی...';

  try {
    if (isMgr) {
      const mp = document.getElementById('manager-pass').value.trim();
      const correct = await getManagerPass();
      if (!correct || mp !== correct) {
        err.style.display = 'block';
        err.textContent = 'رمز مدیر اشتباه';
        return;
      }
      const ex = await getUser(tempPhone);
      if (ex) {
        err.style.display = 'block';
        err.textContent = 'شماره قبلاً ثبت‌نام کرده';
        return;
      }
      localStorage.setItem('pendingManager', JSON.stringify({
        phone: tempPhone,
        name: tempName,
        password: tempPass,
        avatar: tempAvatar || '',
        isTeacher: isTch,
        isVice: isVic,
        createdAt: Date.now()
      }));
      window.location.href = 'panleamoz.html';
      return;
    }

    if (isTch) {
      const tp = document.getElementById('teacher-pass').value.trim();
      const correct = await getTeacherPass();
      if (!correct || tp !== correct) {
        err.style.display = 'block';
        err.textContent = 'رمز معلم اشتباه';
        return;
      }
    }

    if (isVic) {
      const vp = document.getElementById('vice-pass').value.trim();
      const correct = await getVicePass();
      if (!correct || vp !== correct) {
        err.style.display = 'block';
        err.textContent = 'رمز معاون اشتباه';
        return;
      }
    }

    const prov = document.getElementById('province').value.trim();
    const sch = document.getElementById('school').value.trim();
    const grd = document.getElementById('grade').value.trim();

    if (!prov || !sch || !grd) {
      err.style.display = 'block';
      err.textContent = 'همه فیلدها را پر کنید';
      return;
    }

    const ex = await getUser(tempPhone);
    if (ex) {
      err.style.display = 'block';
      err.textContent = 'شماره قبلاً ثبت‌نام کرده';
      return;
    }

    btn.textContent = 'ذخیره...';

    const newU = {
      name: tempName,
      password: tempPass,
      avatar: tempAvatar || '',
      province: prov,
      school: sch,
      city: '',
      grade: grd,
      isManager: false,
      isTeacher: isTch,
      isVice: isVic,
      role: 'user',
      bannedUntil: null,
      profileComplete: true,
      createdAt: Date.now()
    };

    await saveUser(tempPhone, newU);
    localStorage.setItem('currentUser', tempPhone);
    window.location.href = encodeURI('safe asli amoz.html');

  } catch (e) {
    err.style.display = 'block';
    err.textContent = 'خطا در ذخیره';
  } finally {
    btn.disabled = false;
    btn.textContent = 'تأیید و ورود';
  }
}