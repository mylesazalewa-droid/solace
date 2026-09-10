# Installing Solace on a Mac

Solace isn't in the App Store, so the first time you open it macOS will try to
stop you — it shows a warning like **"Solace was not opened because it contains
malware"** or **"Apple could not verify Solace is free of malware."**

**Solace does not contain malware.** That message appears for *any* Mac app that
isn't distributed through the App Store or signed with a paid Apple developer
certificate. You just have to tell your Mac to trust it once.

---

## Step 1 — Copy the app

1. Double-click **Solace.dmg** (from the download).
2. In the window that opens, drag the **Solace** icon onto the **Applications**
   folder.
3. Close the window. You can eject "Solace" from the sidebar in Finder and delete
   the `.dmg` file.

## Step 2 — Let your Mac open it

### The easy way (no typing)

1. Open **System Settings** (the gear icon).
2. Go to **Privacy & Security** in the sidebar.
3. Scroll down to the **Security** section. You'll see a line like
   *"Solace was blocked to protect your Mac."*
4. Click **Open Anyway** next to it.
5. Enter your Mac password or use Touch ID.
6. A final box appears — click **Open Anyway** once more.

Solace opens, and it will open normally every time after that.

> If you don't see the "Open Anyway" line, try double-clicking Solace in your
> Applications folder first — that makes the option appear in Privacy & Security.

### If that didn't work (one Terminal command)

1. Open **Terminal** (press ⌘–Space, type `Terminal`, press Return).
2. Copy and paste this line exactly, then press Return:

   ```
   xattr -cr /Applications/Solace.app
   ```

3. Now open Solace from your Applications folder as normal.

That command removes the "downloaded from the internet" flag from the app.
Nothing else changes.

---

## Why this happens

Apple charges $99/year for the certificate that would make this warning go away.
Until Solace has one, every computer it's installed on needs the one-time step
above. It's safe — you're choosing to trust an app you were given directly, the
same as installing anything from outside the App Store.

## Updating later

When a new version comes out, download the new **Solace.dmg**, and repeat Step 1
(drag it onto Applications, replacing the old one). You usually **don't** need to
repeat Step 2 — but if the malware warning comes back, just run the Terminal
command again.
