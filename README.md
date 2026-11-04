# Whitespace Hub

The staff hub for forms, policies and documents, with all 53 forms rebuilt so they no longer need Jotform.

- **Hub** (`/`): departments, search, favourites and every form, styled like Outlook on the web.
- **Forms** (`/#form/<id>`): the same questions and show/hide rules as the Jotform versions, with file uploads, signatures, star ratings, product pickers and drafts that save on the device.
- **Sign-in** (`/login`): everything is behind a login, with **Sign in with Microsoft** for Microsoft 365 accounts (see below). Two permissions: **Admin** (everything, including submissions, users and renaming folders) and **Viewer** (hub, forms and documents; carbon platform read-only).
- **Submissions** (`/admin`, admins): an Outlook-style inbox. Forms are folders; open a submission to read it (including who sent it), see photos and signatures, mark it done, print it or download a CSV.
- **Users** (`/admin#users`, admins): add people, switch them between Admin and Viewer, reset passwords, remove accounts.
- **Carbon platform** (`/carbon`): company Scope 1–3 footprint, stand footprints, targets, SECR and GHG reports. It uses the hub sign-in, so nobody signs in twice. See `carbon/README.md` for what it does and the note on emission factors.

## How it fits together

One Render service runs both parts from a single Docker image:
- `server.js` (Node) serves the hub, forms and submissions, and passes every `/carbon/...` request to the carbon platform.
- `carbon/` (Python, Flask) runs inside the same service on an internal port. It is never reached directly.
- Form submissions and uploads are stored in Postgres. Carbon data is stored in SQLite on the service's persistent disk (`/var/data`), which Render snapshots daily.

## Put it live on Render

The quickest way is the Blueprint, which creates the web service **and** its database together.

1. Push this folder to your GitHub repo (replace the old files).
2. In Render choose **New → Blueprint**, pick the repo and confirm. It creates:
   - `whitespace-hub` (Docker web service, Starter plan, with a 1 GB disk for carbon data)
   - `whitespace-hub-db` (Postgres, Basic plan) — this is where form submissions and uploads are kept.
   If you already made a Node web service for the hub, delete it once the new one is running: Render can't switch an existing service to Docker.
3. Render will ask for the values marked *sync: false*. Fill in at least:
   | Setting | What to put |
   |---|---|
   | `INITIAL_ADMIN_PASSWORD` | The password for the first admin account (kai@skylinewhitespace.com). Used only when that account is first created. If you leave it blank, a one-time password is printed in the service's **Logs**. |
   | `PUBLIC_URL` | The site address, e.g. `https://whitespace-hub.onrender.com` (used for links in emails). |
   | `NOTIFY_EMAILS` | Who gets emailed about new submissions, comma separated. |
   | `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The mailbox that sends the emails (see below). |
   | `ANTHROPIC_API_KEY` | Optional. Turns on the carbon platform's AI import of bills and invoices. |
4. Deploy, then sign in at `/login` as kai@skylinewhitespace.com with the password from `INITIAL_ADMIN_PASSWORD` (or the one-time password in the Logs). Change it from the account menu (your initials, top right). No password is stored in the code.
5. Add everyone else under **Users**. Each person gets a temporary password to change after they sign in.


> Without `DATABASE_URL` the app saves submissions to the server's own disk. That is fine for trying it out, but Render wipes that disk on every deploy, so always connect Postgres for real use. The dashboard shows a warning until you do.

## Sign in with Microsoft (Microsoft 365 accounts)

Staff can sign in with their Skyline Whitespace Microsoft 365 account. Two-factor sign-in (Microsoft Authenticator, Face ID or fingerprint on phones, Windows Hello) is then handled by Microsoft, using your company's Microsoft security settings. The hub never sees passwords, codes or faces.

**1. Register the app in Microsoft Entra** (a Microsoft 365 admin can do this in about five minutes)
1. Go to **entra.microsoft.com → Applications → App registrations → New registration**.
2. Name: `Whitespace Hub`. Supported account types: **Accounts in this organizational directory only (single tenant)**.
3. Redirect URI: platform **Web**, address `https://YOUR-SITE.onrender.com/auth/microsoft/callback` (use your custom domain if you have one). Select **Register**.
4. On the app's **Overview** page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
5. Go to **Certificates & secrets → New client secret**, choose an expiry (24 months is the longest), and copy the **Value** straight away. Put a reminder in your calendar to renew it before it expires.
6. Leave **API permissions** as they are (`User.Read` is enough).

**2. Add the settings in Render** (service → Environment)
| Setting | What to put |
|---|---|
| `MS_TENANT_ID` | Directory (tenant) ID |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | The client secret **Value** |
| `PUBLIC_URL` | Your site address, exactly as in the redirect URI but without `/auth/microsoft/callback` |

Save and let it redeploy. The login page now shows **Sign in with Microsoft**. Your account (kai@skylinewhitespace.com) is matched by email and stays an Admin.

**Who can get in**
- By default, anyone in your Microsoft 365 organisation can sign in and is added as a **Viewer**. Promote people under **Users**.
- To allow only people you've added under Users, set `MS_AUTO_ADD=0`.
- To limit it in Microsoft instead: Entra → **Enterprise applications → Whitespace Hub → Properties → Assignment required = Yes**, then assign people or groups.

**Two-factor and Face ID**
- Turn on multi-factor sign-in in Entra (Security defaults, or a Conditional Access policy requiring MFA).
- Staff set up Microsoft Authenticator (or a passkey) at **mysignins.microsoft.com**. On iPhones and Android phones the Authenticator app can use Face ID or a fingerprint. The hub's account menu has a link to these settings.

**Email and password as a backup**
- Email and password sign-in stays available under "Sign in with email and password instead", so you can still get in if Microsoft is ever misconfigured.
- Once Microsoft sign-in is working, set `PASSWORD_LOGIN=off` to remove passwords completely. Passwords can't be turned off unless Microsoft sign-in is set up, so you can't lock yourself out.

**If it doesn't work**, check the service's **Logs** for lines starting with `[microsoft]`. Common causes: the redirect URI in Entra doesn't exactly match `PUBLIC_URL` + `/auth/microsoft/callback`, the client secret has expired, or `MS_TENANT_ID` was set to a domain name instead of the tenant ID.

## If Carbon says it isn't available

The page now says why. Check the **Logs** tab of the service in Render for lines starting with `[carbon]`.

- **Best fix:** deploy with the Blueprint (Docker). It installs Python and starts both parts.
- **On a plain Node web service** the hub tries to install and start the carbon platform itself. Set the build command to `npm install` and the start command to `npm start`. If the log says Python isn't available, switch to the Blueprint.
- **Keep carbon data safe:** add a disk to the service (Render → service → Disks, mount path `/var/data`). Without one, carbon data is lost on every deploy.

## Email alerts (Microsoft 365)

The defaults in `render.yaml` point at Microsoft 365 (`smtp.office365.com`, port 587).

1. Use a mailbox such as `forms@skylinewhitespace.com` and put it in `SMTP_USER` and `MAIL_FROM`.
2. Ask your Microsoft 365 admin to turn on **Authenticated SMTP** for that mailbox (Microsoft 365 admin centre → Users → the mailbox → Mail → Manage email apps).
3. Put its password (or an app password if it uses multi-factor sign-in) in `SMTP_PASS`.

Each email shows every answer and attaches the uploaded files and signature (when they total under 15 MB), with a link straight to the submission.

**Different recipients per form:** edit `notify.json`. Every form is listed by name; add addresses to its `emails` list. Forms left empty go to `NOTIFY_EMAILS`.

## The dashboard

The first page everyone sees. It welcomes them by their full name over the showroom photo (`public/dashboard-bg.jpg`; replace that file to change it), with **My tasks** on the left and **Announcements** on the right.

- **Tasks:** admins select **Assign a task**, choose a person, and add an optional due date, notes and a link (a web address or one of the hub's forms). If email is set up, the person gets an email. Everyone ticks off their own tasks. Admins can switch to **Everyone's** to see all tasks, and edit or delete any of them.
- **Announcements:** admins select **Post**. Each one can have a picture: choose a file, drag it in, or paste a screenshot. Large photos are shrunk automatically so the dashboard stays quick. Pinned announcements stay at the top. Everyone sees them.
- **Full names:** set them in **Users → Rename**. People who sign in with Microsoft get their full name from Microsoft 365 automatically if only a first name is stored. `INITIAL_ADMIN_NAME` sets the first admin's name.

## Admins

Kai and Jack Stevens (jack@skylinewhitespace.com) are admins. The first time this version starts, it makes Jack an admin: it promotes his existing account, or creates one if he doesn't have one. It does this only once, so if you change his permission in **Users** later, that change stays. Nobody is removed or downgraded. If the app had to create Jack's account and email-and-password sign-in is on, a one-time password for him is printed in Render's **Logs**. With Microsoft sign-in he just uses **Sign in with Microsoft**. To make other people admins when the app starts, list their emails in the `ADMIN_EMAILS` setting, separated by commas.

Only admins can remove users. Nobody can remove their own account, and the last admin can't be removed.

## Changing content (admins)

Select **Edit** in the top bar. Everything saves straight away and shows for everyone. Select **Done** when you're finished.

- **Folders:** **New folder** in the folder pane, or the **⋯** next to a folder (or right-click it) to rename it, change its colour, move it up or down, move it between Departments and More, or delete it.
- **Sections:** rename, reorder, delete, or **Add a section** at the bottom of a folder.
- **Items:** **Add to …** under any section. An item can be a form (an existing one or a new one), a document (upload a file up to 50 MB, or link to SharePoint or OneDrive), a link, a note, or a shortcut to another folder. Each item has edit, move and delete buttons. Ticking **Show as a quick action** puts a form on the dashboard.
- **Forms:** **Edit form** on any form page opens the form builder. There you can add, reorder, duplicate and delete questions (22 types), set options and required fields, and add show or hide rules based on other answers. The builder also has **Make a copy** and **Delete form**. Past submissions keep the answers they were sent with.
- **Documents still on Jotform:** in Edit mode, **Copy N Jotform documents here** downloads them into the hub so they keep working after Jotform is closed.

Content, forms, uploaded files, tasks and announcements are stored in the database, not in the code. Redeploying doesn't reset them. `seed/` only fills an empty database the first time.

## Good to know

- Every form now needs a sign-in, so clients and suppliers can't fill in the supplier, customer or handover forms unless you give them an account. Ask Claude to make chosen forms public if you need that.
- Forgotten passwords: an admin resets them under **Users**. That signs the person out everywhere.
- Some forms collect bank details, National Insurance numbers and health information. Give Admin only to people who need to see submissions, and delete submissions you no longer need.
- Keep the GitHub repo private.
- Documents (policies, certificates, logos) still link to files hosted on Jotform. Move them before you close the Jotform account; ask Claude to bring them into the app.
- Old Jotform submissions stay in Jotform. Export them there if you want a record.
- The carbon platform trusts the hub's sign-in: hub Admins are carbon admins, hub Viewers are carbon viewers (read-only).
- Carbon's client stand reports stay in Skyline Whitespace navy with your logo, since they go to clients. Replace `carbon/static/img/logo.svg` with the official artwork.
- Run it locally: `npm install`, `pip install -r carbon/requirements.txt`, then in two terminals
  or simply `npm start` (it starts the carbon platform for you). Open http://localhost:3000.
