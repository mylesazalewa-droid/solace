# Solace sync

Two ways to sync. Pick one.

- **A — One-click "Continue with Google".** You (the app owner) do a ~20-minute
  one-time setup, then anyone using your Solace build just clicks one button. No
  console, no config paste for them.
- **B — Bring your own Firebase.** Each person makes their own Firebase project and
  pastes its config into Settings. More setup per person, total control.

Both run entirely on Firebase's **free (Spark) plan** — no billing card.

What syncs: every note (title, body, tags, summary, pinned), notebook cover styles,
notebook shelf order, and your custom templates. Not yet: `_attachments/` originals,
version history, trash. (Imported document *text* syncs — it lives in the note body.)

---

# A. One-click Google — owner setup (do this once)

You'll end with three values to send me. I bake them into the build and hand you a
DMG where "Continue with Google" just works.

### 1. Firebase project

1. <https://console.firebase.google.com/> → **Add project** (e.g. `solace`).

### 2. Firestore

1. **Build → Firestore Database → Create database** → **Production mode** → any
   location → **Enable**.

### 3. Firestore rules

**Firestore → Rules**, replace all, **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // a person's own vault
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // release / update-check doc — world readable, never writable from a client
    match /public/{doc} {
      allow read: if true;
      allow write: if false;
    }

    // published notes — anyone can read the link, only the owner can change it
    match /pages/{id} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.owner == request.auth.uid;
      allow update: if request.auth != null
                    && resource.data.owner == request.auth.uid
                    && request.resource.data.owner == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.owner == request.auth.uid;
    }
  }
}
```

### 4. Turn on Google sign-in

1. **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable.** Set the support email. **Save.**

### 5. OAuth consent screen

This is in **Google Cloud Console** (same project): <https://console.cloud.google.com/>
→ make sure the project name (top bar) is your Firebase project → **APIs & Services
→ OAuth consent screen**.

1. User type **External** → **Create**.
2. App name `Solace`, user support email = yours, developer contact email = yours →
   **Save and continue**.
3. **Scopes → Add or remove scopes** → tick `openid`,
   `.../auth/userinfo.email`, `.../auth/userinfo.profile` → **Update** → **Save and
   continue**.
4. Test users step → **Save and continue** → **Back to dashboard**.
5. **Publish app** → confirm. (These three scopes are "non-sensitive" — Google does
   **not** require a verification review for them.)

### 6. Desktop OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**.

1. Application type **Desktop app**, name `Solace desktop` → **Create**.
2. Copy the **Client ID** and **Client secret**.
   (For desktop apps this "secret" is not confidential — it's meant to ship inside
   the app.)

### 7. Web config

**Firebase → Project settings (gear) → General → Your apps → `</>` (Web)** → register
`solace` → copy the `firebaseConfig` object.

### 8. Send me these three things

- the `firebaseConfig` object
- the desktop **Client ID**
- the desktop **Client secret**

I put them in the build. From then on, every copy of Solace shows **"Continue with
Google"** in Settings → Sync — one click, no other setup.

---

# B. Bring your own Firebase (works today, no owner setup)

1. Do steps 1–3 above (project, Firestore, rules).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Project settings → Your apps → `</>` (Web)** → register → copy `firebaseConfig`.
4. In Solace: **Settings → Sync across devices → "Set up Firebase"** → paste the
   config → **Save config** → enter an email + password (6+ chars) → **Sign in /
   Create account**.
5. On your other Mac: same config, same email + password.

---

## Using it on another Mac

Install the same Solace build, open **Settings → Sync**, and either **Continue with
Google** (path A) or paste the same config + sign in (path B). Your notes flow down.

> Tip: on the second Mac, point Solace at an **empty** folder first (Settings →
> "Choose a different folder"), then sign in — everything arrives from the cloud with
> zero conflicts. If both Macs already have notes, that's fine too: where the same
> note differs, Solace keeps the newer one and saves the other beside it as
> `… (from <computer> <date>).md`.

## When it syncs

On launch, when the window comes back to the front, every 5 minutes while open, and
on **Sync now**. **Force full sync** re-checks every note against the cloud from
scratch (use it if something ever looks out of step).

## Cost

Firestore free tier: 50,000 reads / 20,000 writes per day, 1 GiB stored. A personal
vault syncing a few times an hour uses a sliver of that. If it ever got popular
enough to matter, you'd switch on pay-as-you-go (still ~$0 for light use).
