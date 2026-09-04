// ============================================================
// BudgetCore — firebase.js
// Firebase app initialisation — exported singletons used by app.js
// ============================================================
//
// HOW TO CONFIGURE:
//   1. Go to https://console.firebase.google.com → your project → Project Settings
//   2. Under "Your apps" → Web app, copy the firebaseConfig object
//   3. Paste the real values below (replace every placeholder string)
//   4. In the Firebase console:
//      • Authentication → Sign-in method → Enable "Email/Password"
//      • Firestore Database → Create database (start in Production mode)
//      • Firestore Database → Rules → paste the contents of firestore.rules

import { initializeApp }                    from 'firebase/app';
import { getAuth, GoogleAuthProvider }      from 'firebase/auth';
import { getFirestore }                     from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDX0KJCfpvp4ljNuB2K61DdXEMEOUb1N_w",
  authDomain:        "budgetary-e8d1d.firebaseapp.com",
  projectId:         "budgetary-e8d1d",
  storageBucket:     "budgetary-e8d1d.firebasestorage.app",
  messagingSenderId: "660657472083",
  appId:             "1:660657472083:web:201b8555b568553fd6bca6",
  measurementId:     "G-MXSPM0P00H",
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
