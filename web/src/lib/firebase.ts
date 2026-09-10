import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'

// Same Firebase project the desktop app syncs to. A web config is public by design.
const app = initializeApp({
  apiKey: 'AIzaSyDM3wcWiyyPlDDyYtXdOj6BHYr63ShecWQ',
  authDomain: 'solace-cfee3.firebaseapp.com',
  projectId: 'solace-cfee3',
  storageBucket: 'solace-cfee3.firebasestorage.app',
  messagingSenderId: '376436827620',
  appId: '1:376436827620:web:2f5fc21cef2dcc92a513f1'
})

export const auth = getAuth(app)
void setPersistence(auth, browserLocalPersistence)

// offline-capable local cache so edits survive a flaky connection / reload
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})

export const googleProvider = new GoogleAuthProvider()
