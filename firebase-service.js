// Camada de persistência: LocalStorage + Sincronização em tempo real com Firebase Firestore
// Você pode usar um novo projeto Firebase na mesma conta Google do app Pulso (ou uma coleção dedicada).

const STORAGE_KEY = 'app_financeiro_state_v1';
const FIREBASE_CONFIG_KEY = 'app_financeiro_firebase_config_v1';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBJ8Jb0w6ETxfEaLtChY6_VIOYlBDijFuk",
  authDomain: "financeiro-353c3.firebaseapp.com",
  projectId: "financeiro-353c3",
  storageBucket: "financeiro-353c3.firebasestorage.app",
  messagingSenderId: "952320326087",
  appId: "1:952320326087:web:3a57c0ce93690d6fe481e2"
};

export class FinanceStorageService {
  constructor(onRemoteUpdate) {
    this.onRemoteUpdate = onRemoteUpdate;
    this.db = null;
    this.docRef = null;
    this.unsubscribe = null;
    this.isConnected = false;
    this.projectId = null;
  }

  getSavedFirebaseConfig() {
    try {
      const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_FIREBASE_CONFIG;
  }

  saveFirebaseConfig(configObj) {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(configObj));
  }

  clearFirebaseConfig() {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isConnected = false;
    this.db = null;
    this.projectId = null;
  }

  loadLocalState(defaultState) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState;
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch (e) {
      console.error('Erro ao ler dados locais:', e);
      return defaultState;
    }
  }

  async saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Erro ao salvar no LocalStorage:', e);
    }

    if (this.isConnected && this.docRef && this.setDoc) {
      try {
        await this.setDoc(this.docRef, {
          ...state,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Erro ao sincronizar com o Firebase Firestore:', err);
      }
    }
  }

  async connectFirebase(config, currentState) {
    if (!config || !config.apiKey || !config.projectId) {
      throw new Error('Configuração inválida: apiKey e projectId são obrigatórios.');
    }

    const [{ initializeApp, getApps, getApp }, { getFirestore, doc, setDoc, getDoc, onSnapshot }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js')
    ]);

    const appName = 'AppFinanceiroClient';
    const existing = getApps().find((a) => a.name === appName);
    const app = existing ? getApp(appName) : initializeApp(config, appName);

    this.db = getFirestore(app);
    this.setDoc = setDoc;
    // Coleção exclusiva "app_financeiro_ciclo" para nunca conflitar caso use o mesmo projeto ou outro projeto
    this.docRef = doc(this.db, 'app_financeiro_ciclo', 'usuario_principal');

    const snap = await getDoc(this.docRef);
    if (snap.exists()) {
      const remoteData = snap.data();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
      if (this.onRemoteUpdate) this.onRemoteUpdate(remoteData);
    } else if (currentState) {
      await setDoc(this.docRef, {
        ...currentState,
        updatedAt: new Date().toISOString()
      });
    }

    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = onSnapshot(this.docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        if (this.onRemoteUpdate) this.onRemoteUpdate(data);
      }
    });

    this.isConnected = true;
    this.projectId = config.projectId;
    this.saveFirebaseConfig(config);
    return true;
  }
}
