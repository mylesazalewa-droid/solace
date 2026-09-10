# Installing Solace on a Mac

Solace isn't in the App Store, so the first time you open it macOS asks you to
confirm. You do this **once per computer**.

---

## Step 1 — Copy the app

1. Double-click **Solace.dmg**.
2. Drag the **Solace** icon onto the **Applications** folder.
3. Close the window; you can eject "Solace" from the Finder sidebar and delete the
   `.dmg`.

## Step 2 — Open it the first time

1. Open your **Applications** folder and **double-click Solace**.
2. You'll see *"Apple could not verify Solace is free of malware."* Click
   **Done** (not "Move to Trash").
3. Open **System Settings → Privacy & Security**.
4. Scroll down to **Security**. There's now a line: *"Solace was blocked to
   protect your Mac."* Click **Open Anyway**.
5. Confirm with your password or Touch ID, then click **Open Anyway** once more.

Solace opens, and from now on it opens with a normal double-click.

### If "Open Anyway" isn't there

Open **Terminal** (⌘–Space, type `Terminal`), paste this, press Return:

```
xattr -cr /Applications/Solace.app
```

Then open Solace from Applications as normal.

---

## Why this happens

Solace is signed, but not with Apple's paid ($99/year) "notarization," so macOS
wants you to approve it by hand the first time. It's safe — you're approving an
app you were handed directly. Once notarization is set up, this step goes away.

## Updating later

Download the new **Solace.dmg**, drag it onto Applications replacing the old one.
Usually you can just open it — if the confirmation comes back, repeat Step 2.
