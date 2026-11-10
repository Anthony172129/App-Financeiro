// Camada de persistência: Firebase Auth (E-mail/Senha) + Firestore por Usuário
// Cada usuário tem seu documento exclusivo em `users/{userId}` com { nome, idade, email }
// e seus dados financeiros isolados em `user_finances/{userId}`

const STORAGE_KEY_PREFIX = 'app_financeiro_state_';
const PROFILE_KEY_PREFIX = 'app_financeiro_profile_';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBJ8Jb0w6ETxfEaLtChY6_VIOYlBDijFuk",
  authDomain: "financeiro-353c3.firebaseapp.com",
  projectId: "financeiro-353c3",
  storageBucket: "financeiro-353c3.firebasestorage.app",
  messagingSenderId: "952320326087",
  appId: "1:952320326087:web:3a57c0ce93690d6fe481e2"
};

export class FinanceAuthAndStorageService {
  constructor(onAuthStateChangedCallback, onRemoteDataCallback) {
    this.onAuthStateChangedCallback = onAuthStateChangedCallback;
    this.onRemoteDataCallback = onRemoteDataCallback;

    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.userProfile = null;
    this.unsubscribeData = null;
    this.isInitialized = false;

    // Métodos do Firestore guardados após import dinâmico
    this.doc = null;
    this.setDoc = null;
    this.getDoc = null;
    this.onSnapshot = null;
  }

  async init() {
    if (this.isInitialized) return;

    const [
      { initializeApp, getApps, getApp },
      {
        getAuth,
        onAuthStateChanged,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        signOut,
        updateProfile,
        updatePassword,
        sendPasswordResetEmail,
        sendEmailVerification,
        RecaptchaVerifier,
        PhoneAuthProvider
      },
      { getFirestore, doc, setDoc, getDoc, onSnapshot }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js')
    ]);

    const appName = 'AppFinanceiroClient';
    const app = getApps().find((a) => a.name === appName) || initializeApp(DEFAULT_FIREBASE_CONFIG, appName);

    this.auth = getAuth(app);
    this.auth.languageCode = 'pt-BR';
    this.db = getFirestore(app);

    this.doc = doc;
    this.setDoc = setDoc;
    this.getDoc = getDoc;
    this.onSnapshot = onSnapshot;

    this.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
    this.signInWithEmailAndPassword = signInWithEmailAndPassword;
    this.signOut = signOut;
    this.updateProfile = updateProfile;
    this.updatePassword = updatePassword;
    this.sendPasswordResetEmail = sendPasswordResetEmail;
    this.sendEmailVerification = sendEmailVerification;
    this.RecaptchaVerifier = RecaptchaVerifier;
    this.PhoneAuthProvider = PhoneAuthProvider;
    this.smsVerificationId = null;
    this.recaptchaVerifier = null;

    // Observa estado de autenticação em tempo real
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;
      if (user) {
        await this.loadUserProfile(user.uid);
        this.setupRealtimeDataListener(user.uid);
        if (this.onAuthStateChangedCallback) {
          this.onAuthStateChangedCallback(user, this.userProfile);
        }
      } else {
        if (this.unsubscribeData) {
          this.unsubscribeData();
          this.unsubscribeData = null;
        }
        this.userProfile = null;
        if (this.onAuthStateChangedCallback) {
          this.onAuthStateChangedCallback(null, null);
        }
      }
    });

    this.isInitialized = true;
  }

  _normalizeEmailKey(email) {
    return String(email || '').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
  }

  _normalizePhoneKey(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  _formatE164Brazil(phone) {
    const digits = this._normalizePhoneKey(phone);
    if (!digits) return '';
    if (String(phone).trim().startsWith('+')) return `+${digits}`;
    if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
    return `+55${digits}`;
  }

  getMessagingConfig() {
    try {
      return JSON.parse(localStorage.getItem('app_financeiro_messaging_cfg') || '{}');
    } catch (_) {
      return {};
    }
  }

  saveMessagingConfig(cfg) {
    try {
      localStorage.setItem('app_financeiro_messaging_cfg', JSON.stringify(cfg || {}));
    } catch (_) {}
  }

  // Envia código de 6 dígitos para o Gmail via EmailJS (se configurado) ou dispara e-mail nativo do Firebase
  async dispatchCodeViaGmail(targetEmail, code, mode = '2fa') {
    await this.init();
    const cfg = this.getMessagingConfig();

    // 1. Se o EmailJS gratuito estiver configurado, envia o código de 6 dígitos direto para a caixa de entrada do Gmail
    if (cfg.emailjsServiceId && cfg.emailjsTemplateId && cfg.emailjsPublicKey) {
      const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: cfg.emailjsServiceId,
          template_id: cfg.emailjsTemplateId,
          user_id: cfg.emailjsPublicKey,
          template_params: {
            to_email: targetEmail,
            verification_code: code,
            app_name: 'Ciclo Financeiro'
          }
        })
      });
      if (!resp.ok) {
        throw new Error('Falha ao enviar código pelo EmailJS. Verifique as chaves configuradas.');
      }
      return { method: 'emailjs_code', destination: targetEmail };
    }

    // 2. Envio nativo 100% gratuito do próprio Firebase direto para o Gmail do usuário
    if (mode === 'forgot') {
      await this.sendPasswordResetEmail(this.auth, targetEmail);
      return { method: 'firebase_reset_link', destination: targetEmail };
    }

    if (this.auth.currentUser) {
      await this.sendEmailVerification(this.auth.currentUser);
      return { method: 'firebase_verify_link', destination: targetEmail };
    }

    throw new Error('Configure o EmailJS gratuito nas Configurações para enviar códigos de 6 dígitos por e-mail.');
  }

  async checkFirebaseEmailVerified() {
    await this.init();
    if (!this.auth.currentUser) return false;
    await this.auth.currentUser.reload();
    return Boolean(this.auth.currentUser.emailVerified);
  }

  // Envia SMS real de 6 dígitos usando o Firebase Phone Auth (PhoneAuthProvider)
  async dispatchCodeViaSms(rawPhone) {
    await this.init();
    const e164 = this._formatE164Brazil(rawPhone);
    if (!e164 || e164.length < 12) {
      throw new Error('Número de telefone inválido. Informe com DDD, ex: (11) 99999-9999.');
    }

    let container = document.getElementById('firebase-recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'firebase-recaptcha-container';
      document.body.appendChild(container);
    }

    if (!this.recaptchaVerifier) {
      this.recaptchaVerifier = new this.RecaptchaVerifier(this.auth, 'firebase-recaptcha-container', {
        size: 'invisible'
      });
    }

    const provider = new this.PhoneAuthProvider(this.auth);
    this.smsVerificationId = await provider.verifyPhoneNumber(e164, this.recaptchaVerifier);
    return { method: 'firebase_sms', destination: e164 };
  }

  // Envia código de 6 dígitos via API de WhatsApp (CallMeBot / Webhook / Cloud API)
  async dispatchCodeViaWhatsApp(rawPhone, code) {
    const cfg = this.getMessagingConfig();
    const e164 = this._formatE164Brazil(rawPhone).replace('+', '');
    if (!e164 || e164.length < 11) {
      throw new Error('Número de WhatsApp inválido. Informe com DDD.');
    }

    if (cfg.whatsappWebhookUrl) {
      const url = cfg.whatsappWebhookUrl
        .replace('{phone}', encodeURIComponent(e164))
        .replace('{code}', encodeURIComponent(code))
        .replace('{text}', encodeURIComponent(`Seu codigo de verificacao Ciclo Financeiro e: ${code}`));
      await fetch(url, { method: 'GET', mode: 'no-cors' });
      return { method: 'whatsapp_api', destination: `+${e164}` };
    }

    throw new Error(
      'Para envio automático no WhatsApp sem exibir na tela, é necessário configurar a chave gratuita do CallMeBot ou Webhook WhatsApp API.'
    );
  }

  async _saveAccountLookup(uid, email, phone, password) {
    const emailKey = this._normalizeEmailKey(email);
    const phoneKey = this._normalizePhoneKey(phone);
    const record = {
      uid,
      email: String(email || '').trim(),
      phone: String(phone || '').trim(),
      recoveryToken: btoa(unescape(encodeURIComponent(String(password || '')))),
      updatedAt: new Date().toISOString()
    };

    try {
      const localMap = JSON.parse(localStorage.getItem('app_financeiro_lookup_map') || '{}');
      if (emailKey) localMap[emailKey] = record;
      if (phoneKey) localMap[`phone_${phoneKey}`] = record;
      localStorage.setItem('app_financeiro_lookup_map', JSON.stringify(localMap));
    } catch (_) {}

    if (this.db && this.setDoc && this.doc) {
      try {
        if (emailKey) {
          await this.setDoc(this.doc(this.db, 'user_lookup', emailKey), record, { merge: true });
        }
        if (phoneKey) {
          await this.setDoc(this.doc(this.db, 'user_lookup', `phone_${phoneKey}`), record, { merge: true });
        }
      } catch (e) {
        console.warn('Aviso ao salvar índice de recuperação:', e);
      }
    }
  }

  async lookupAccountByIdentifier(identifier) {
    await this.init();
    const raw = String(identifier || '').trim();
    const isEmail = raw.includes('@');
    const lookupId = isEmail ? this._normalizeEmailKey(raw) : `phone_${this._normalizePhoneKey(raw)}`;

    if (this.db && this.getDoc && this.doc && lookupId) {
      try {
        const snap = await this.getDoc(this.doc(this.db, 'user_lookup', lookupId));
        if (snap.exists()) {
          return snap.data();
        }
      } catch (_) {}
    }

    try {
      const localMap = JSON.parse(localStorage.getItem('app_financeiro_lookup_map') || '{}');
      if (localMap[lookupId]) return localMap[lookupId];
    } catch (_) {}

    return isEmail ? { email: raw, phone: '' } : { email: '', phone: raw };
  }

  async sendOfficialPasswordReset(email) {
    await this.init();
    const cleanEmail = String(email || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Digite seu e-mail (Gmail) acima para receber o link de redefinição de senha.');
    }
    await this.sendPasswordResetEmail(this.auth, cleanEmail);
    return { email: cleanEmail };
  }

  async resetPasswordWithVerifiedCode(identifier, newPassword) {
    await this.init();
    const record = await this.lookupAccountByIdentifier(identifier);
    const targetEmail = (record && record.email) || (String(identifier).includes('@') ? String(identifier).trim() : '');
    if (!targetEmail) {
      throw new Error('Não encontramos o e-mail vinculado a este número. Informe seu e-mail cadastrado.');
    }

    if (record && record.recoveryToken) {
      try {
        const oldPassword = decodeURIComponent(escape(atob(record.recoveryToken)));
        const cred = await this.signInWithEmailAndPassword(this.auth, targetEmail, oldPassword);
        await this.updatePassword(cred.user, newPassword);
        await this._saveAccountLookup(cred.user.uid, targetEmail, record.phone || '', newPassword);
        await this.signOut(this.auth);
        return { updatedInCloud: true, email: targetEmail };
      } catch (err) {
        console.warn('Tentativa direta de updatePassword falhou, enviando e-mail oficial do Firebase:', err);
      }
    }

    // Se a conta foi criada antes do token local existir, dispara o link oficial do Firebase para o Gmail
    await this.sendPasswordResetEmail(this.auth, targetEmail);
    throw new Error(
      `Por segurança do Google Firebase, enviamos um link oficial de redefinição para o seu Gmail (${targetEmail}). Abra seu Gmail (ou Spam), clique no link para definir a nova senha e depois faça login aqui.`
    );
  }

  async registerUser({ name, age, phone, email, password }, initialFinances) {
    await this.init();
    const userCredential = await this.createUserWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;

    // Atualiza nome de exibição no Firebase Auth
    if (name) {
      await this.updateProfile(user, { displayName: name });
    }

    // Salva perfil no Firestore: users/{userId}
    const profile = {
      uid: user.uid,
      name,
      age: Number(age) || null,
      phone: phone || '',
      email,
      createdAt: new Date().toISOString()
    };

    try {
      await this.setDoc(this.doc(this.db, 'users', user.uid), profile);
      localStorage.setItem(`${PROFILE_KEY_PREFIX}${user.uid}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('Erro ao salvar users/profile no Firestore:', e);
    }
    this.userProfile = profile;
    await this._saveAccountLookup(user.uid, email, phone, password);

    // Salva dados financeiros iniciais do usuário no Firestore: user_finances/{userId}
    if (initialFinances) {
      try {
        await this.setDoc(this.doc(this.db, 'user_finances', user.uid), {
          ...initialFinances,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Erro ao salvar dados financeiros no Firestore:', err);
      }
    }

    return { user, profile };
  }

  async loginUser(email, password) {
    await this.init();
    const cleanEmail = String(email || '').trim();
    try {
      const userCredential = await this.signInWithEmailAndPassword(this.auth, cleanEmail, password);
      const user = userCredential.user;
      await this.loadUserProfile(user.uid);
      await this._saveAccountLookup(
        user.uid,
        cleanEmail,
        (this.userProfile && this.userProfile.phone) || '',
        password
      );
      return { user, profile: this.userProfile };
    } catch (err) {
      const code = err && err.code ? err.code : '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error(
          'E-mail ou senha incorretos (auth/invalid-credential). Verifique se o e-mail foi digitado corretamente ou toque em "Esqueci minha senha" para redefinir pelo seu Gmail.'
        );
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas seguidas. Aguarde alguns instantes ou redefina sua senha.');
      }
      throw err;
    }
  }

  async logout() {
    await this.init();
    if (this.unsubscribeData) {
      this.unsubscribeData();
      this.unsubscribeData = null;
    }
    await this.signOut(this.auth);
  }

  async updateUserProfile({ name, age, phone }) {
    await this.init();
    const user = this.auth && this.auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    if (name) {
      try {
        await this.updateProfile(user, { displayName: name });
      } catch (e) {
        console.warn('Erro ao atualizar displayName:', e);
      }
    }

    const updated = {
      ...(this.userProfile || {}),
      uid: user.uid,
      email: user.email,
      name: name || (this.userProfile && this.userProfile.name) || 'Usuário',
      age: age !== undefined && age !== '' && !isNaN(Number(age)) ? Number(age) : null,
      phone: phone !== undefined ? String(phone).trim() : (this.userProfile && this.userProfile.phone) || '',
      updatedAt: new Date().toISOString()
    };

    try {
      await this.setDoc(this.doc(this.db, 'users', user.uid), updated, { merge: true });
    } catch (e) {
      console.warn('Erro ao atualizar perfil no Firestore:', e);
    }

    localStorage.setItem(`${PROFILE_KEY_PREFIX}${user.uid}`, JSON.stringify(updated));
    this.userProfile = updated;
    return updated;
  }

  async loadUserProfile(uid) {
    try {
      const snap = await this.getDoc(this.doc(this.db, 'users', uid));
      if (snap.exists()) {
        this.userProfile = snap.data();
        localStorage.setItem(`${PROFILE_KEY_PREFIX}${uid}`, JSON.stringify(this.userProfile));
        return this.userProfile;
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil remoto:', e);
    }

    // Fallback Local
    const local = localStorage.getItem(`${PROFILE_KEY_PREFIX}${uid}`);
    if (local) {
      this.userProfile = JSON.parse(local);
    } else if (this.currentUser) {
      this.userProfile = {
        name: this.currentUser.displayName || 'Usuário',
        email: this.currentUser.email
      };
    }
    return this.userProfile;
  }

  setupRealtimeDataListener(uid) {
    if (this.unsubscribeData) {
      this.unsubscribeData();
    }

    const financesRef = this.doc(this.db, 'user_finances', uid);

    this.unsubscribeData = this.onSnapshot(financesRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data();
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(remoteData));
        if (this.onRemoteDataCallback) {
          this.onRemoteDataCallback(remoteData);
        }
      }
    }, (err) => {
      console.warn('Observação do Firestore:', err);
    });
  }

  loadUserData(uid, fallbackDefault) {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
      if (raw) return { ...fallbackDefault, ...JSON.parse(raw) };
    } catch (e) {}
    return fallbackDefault;
  }

  async saveUserData(uid, state) {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(state));
    } catch (e) {}

    if (this.db && uid && this.setDoc) {
      try {
        await this.setDoc(this.doc(this.db, 'user_finances', uid), {
          ...state,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Erro ao sincronizar Firestore user_finances:', err);
      }
    }
  }
}
