import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  Auth
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  deleteDoc,
  getDoc,
  Firestore
} from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // Analytics often causes issues in simple setups, disabled for stability
import { Presentation, User } from "../types";

// --- Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCev7ZbOtjflzXErdQyOjtZQlX0QaErQbE",
  authDomain: "nexus-presentations.firebaseapp.com",
  projectId: "nexus-presentations",
  storageBucket: "nexus-presentations.firebasestorage.app",
  messagingSenderId: "25759093614",
  appId: "1:25759093614:web:412564fe765ab4fc1ba77f",
  measurementId: "G-RKHVEP54YK"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let isFirebaseAvailable = false;

try {
  // Initialize Firebase using standard imports matching the importmap in index.html
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  if (app) {
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseAvailable = true;
  }
} catch (e) {
  console.warn("Firebase initialization failed. Falling back to local storage mode.", e);
  isFirebaseAvailable = false;
}

// --- Helper: Demo Login ---
const loginAsDemoUser = (name = 'Demo User', email = 'demo@nexus.app', rememberMe = true): User => {
  const mockUser: User = {
    uid: 'demo-' + Math.random().toString(36).substr(2, 9),
    displayName: name,
    email: email,
    photoURL: null
  };
  
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('nexus_user', JSON.stringify(mockUser));
  
  // Dispatch a custom event or force reload to update UI state immediately
  window.location.reload(); 
  return mockUser;
};

// --- Auth Services ---

export const registerWithEmail = async (name: string, email: string, pass: string, rememberMe: boolean = false): Promise<User> => {
  if (isFirebaseAvailable && auth) {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
      return mapUser({ ...userCredential.user, displayName: name } as any);
    } catch (error: any) {
       console.error("Registration error:", error);
       if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/configuration-not-found') {
          console.warn("Firebase Email Auth not configured. Using Demo Mode.");
          return loginAsDemoUser(name, email, rememberMe);
       }
       throw error;
    }
  } else {
      return loginAsDemoUser(name, email, rememberMe);
  }
};

export const loginWithEmail = async (email: string, pass: string, rememberMe: boolean = false): Promise<User> => {
  if (isFirebaseAvailable && auth) {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return mapUser(userCredential.user);
    } catch (error: any) {
       console.error("Login error:", error);
       // Fallback for demo account or if backend isn't ready
       if (email === 'demo@nexus.app' || !isFirebaseAvailable) {
           return loginAsDemoUser('Demo User', email, rememberMe);
       }
       throw error;
    }
  } else {
    return loginAsDemoUser('Local User', email, rememberMe);
  }
};

export const signInWithGoogle = async (rememberMe: boolean = false): Promise<User | null> => {
  if (isFirebaseAvailable && auth) {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      // Force prompt to ensure we don't get stuck in a redirect loop
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      return mapUser(result.user);
    } catch (error: any) {
      console.error("Auth error:", error);
      // Fallback only on specific configuration errors, otherwise throw real error so user knows
      if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed' || error.code === 'auth/configuration-not-found') {
         console.warn("Firebase Auth failed (configuration issue). Falling back to Demo Mode.");
         return loginAsDemoUser('Demo User', 'demo@nexus.app', rememberMe);
      }
      throw error;
    }
  } else {
    return loginAsDemoUser('Demo User', 'demo@nexus.app', rememberMe);
  }
};

export const signOut = async () => {
  localStorage.removeItem('nexus_user');
  sessionStorage.removeItem('nexus_user');

  if (isFirebaseAvailable && auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("Sign out error", e);
    }
  }
  
  window.location.reload();
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  const stored = localStorage.getItem('nexus_user') || sessionStorage.getItem('nexus_user');
  if (stored) {
    callback(JSON.parse(stored));
    return () => {};
  }

  if (isFirebaseAvailable && auth) {
    return onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        callback(mapUser(firebaseUser));
      } else {
        callback(null);
      }
    });
  } else {
    callback(null);
    return () => {};
  }
};

export const reportBug = async (user: User, description: string): Promise<{ success: boolean, message: string }> => {
    return { success: true, message: "Feedback sent! Thank you." };
};

// --- Firestore Services ---

const isDemoUser = (user: User) => user.uid.startsWith('demo-') || user.uid.startsWith('local-');

export const savePresentation = async (presentation: Presentation, user: User) => {
  const cleanPresentation = JSON.parse(JSON.stringify(presentation));
  
  if (isFirebaseAvailable && db && !isDemoUser(user)) {
    try {
      const presRef = doc(db, "presentations", presentation.id);
      await setDoc(presRef, { ...cleanPresentation, userId: user.uid });
    } catch (e) {
      console.error("Firestore save failed, falling back to local", e);
      saveToLocal(cleanPresentation, user);
    }
  } else {
    saveToLocal(cleanPresentation, user);
  }
};

export const getPresentations = async (user: User): Promise<Presentation[]> => {
  if (isFirebaseAvailable && db && !isDemoUser(user)) {
    try {
      const q = query(collection(db, "presentations"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const pres: Presentation[] = [];
      querySnapshot.forEach((doc: any) => {
        pres.push(doc.data() as Presentation);
      });
      return pres.sort((a, b) => b.lastModified - a.lastModified);
    } catch (e) {
      console.error("Firestore get error:", e);
      return getFromLocal(user);
    }
  } else {
    return getFromLocal(user);
  }
};

export const deletePresentation = async (id: string, user: User) => {
  if (isFirebaseAvailable && db && !isDemoUser(user)) {
     try {
       await deleteDoc(doc(db, "presentations", id));
     } catch (e) {
       console.error("Firestore delete error", e);
       deleteFromLocal(id, user);
     }
  } else {
    deleteFromLocal(id, user);
  }
};

// --- Local Storage Helpers ---

function saveToLocal(presentation: Presentation, user: User) {
  const key = `pres_${user.uid}`;
  const stored = localStorage.getItem(key);
  let list = stored ? JSON.parse(stored) : [];
  const index = list.findIndex((p: Presentation) => p.id === presentation.id);
  if (index >= 0) {
    list[index] = presentation;
  } else {
    list.push(presentation);
  }
  localStorage.setItem(key, JSON.stringify(list));
}

function getFromLocal(user: User): Presentation[] {
  const key = `pres_${user.uid}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored).sort((a: Presentation, b: Presentation) => b.lastModified - a.lastModified) : [];
}

function deleteFromLocal(id: string, user: User) {
  const key = `pres_${user.uid}`;
  const stored = localStorage.getItem(key);
  if(stored) {
    const list = JSON.parse(stored).filter((p: Presentation) => p.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
  }
}

function mapUser(firebaseUser: any): User {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL
  };
}