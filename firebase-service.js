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
      { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile },
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

  async registerUser({ name, age, email, password }, initialFinances) {
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

  async updateUserProfile({ name, age }) {
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
