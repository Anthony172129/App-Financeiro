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
      { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, updatePassword, sendPasswordResetEmail },
      { getFirestore, doc, setDoc, getDoc, onSnapshot }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js')
    ]);

    const appName = 'AppFinanceiroClient';
    const app = getApps().find((a) => a.name === appName) || initializeApp(DEFAULT_FIREBASE_CONFIG, appName);

    this.auth = getAuth(app);
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
        console.warn('Tentativa direta de updatePassword falhou, salvando nova credencial:', err);
      }
    }

    // Caso a conta tenha sido criada antes de registrar recoveryToken, atualiza o registro local/cloud
    await this._saveAccountLookup(record.uid || 'local', targetEmail, record.phone || '', newPassword);
    return { updatedInCloud: true, email: targetEmail };
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
    const userCredential = await this.signInWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;
    await this.loadUserProfile(user.uid);
    await this._saveAccountLookup(
      user.uid,
      email,
      (this.userProfile && this.userProfile.phone) || '',
      password
    );
    return { user, profile: this.userProfile };
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
