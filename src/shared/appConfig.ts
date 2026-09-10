// The shared Solace sync backend — lets anyone turn on sync with one click of
// "Continue with Google", no Firebase console or config pasting.
//
// The Firebase web config and the Google OAuth *client ID* are public by design
// (the config is guarded by Firestore rules; the client ID shows up in the OAuth
// redirect URL). The OAuth *client secret* is a different story for GitHub's secret
// scanner even though Google treats desktop-app secrets as non-confidential — so it
// lives in `.env.local` (git-ignored) and is read in src/main/googleAuth.ts via
// import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET. See .env.example.

interface SharedFirebase {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId?: string
  storageBucket?: string
}

export const SHARED: {
  firebase: SharedFirebase | null
  googleClientId: string
  /** where published note links resolve (the Vercel-hosted web app) */
  webAppUrl: string
} = {
  webAppUrl: 'https://solace-livid-nu.vercel.app',
  firebase: {
    apiKey: 'AIzaSyDM3wcWiyyPlDDyYtXdOj6BHYr63ShecWQ',
    authDomain: 'solace-cfee3.firebaseapp.com',
    projectId: 'solace-cfee3',
    storageBucket: 'solace-cfee3.firebasestorage.app',
    messagingSenderId: '376436827620',
    appId: '1:376436827620:web:2f5fc21cef2dcc92a513f1'
  },
  googleClientId: '376436827620-r3ea0rcmtlivmvn5r2kaf80iq22q3plj.apps.googleusercontent.com'
}

export function hasSharedSync(): boolean {
  return !!SHARED.firebase && SHARED.googleClientId.length > 0
}
