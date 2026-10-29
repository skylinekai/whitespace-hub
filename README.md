# Whitespace Hub

The staff hub for forms, policies and documents, with all 53 forms rebuilt so they no longer need Jotform.

- **Hub** (`/`): departments, search, favourites and every form, styled like Outlook on the web.
- **Forms** (`/#form/<id>`): the same questions and show/hide rules as the Jotform versions, with file uploads, signatures, star ratings, product pickers and drafts that save on the device.
- **Sign-in** (`/login`): everything is behind a login. Two permissions: **Admin** (everything, including submissions, users and renaming folders) and **Viewer** (hub, forms and documents; carbon platform read-only).
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
   | `PUBLIC_URL` | The site address, e.g. `https://whitespace-hub.onrender.com` (used for links in emails). |
   | `NOTIFY_EMAILS` | Who gets emailed about new submissions, comma separated. |
   | `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The mailbox that sends the emails (see below). |
   | `ANTHROPIC_API_KEY` | Optional. Turns on the carbon platform's AI import of bills and invoices. |
4. Deploy, then sign in at `/login` with the first admin account (kai@skylinewhitespace.com). It is created automatically the first time the app starts. Change its password from the account menu (your initials, top right).
5. Add everyone else under **Users**. Each person gets a temporary password to change after they sign in.


> Without `DATABASE_URL` the app saves submissions to the server's own disk. That is fine for trying it out, but Render wipes that disk on every deploy, so always connect Postgres for real use. The dashboard shows a warning until you do.

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

## Changing content

- **Department folder names:** right-click a department in the hub's folder pane (or long-press on a phone) and choose **Rename**. Admins only; the new name shows for everyone. **Reset name** puts the original back.

- **Hub sections, documents and links:** `public/hub-data.js`. Each item is one line:
  `['f', 'Title', '<form id>']` form · `['d', 'Title', '~File.pdf']` document · `['l', 'Title', 'https://…']` link · `['n', '<p>Text</p>']` note.
- **Form questions:** `public/forms.json`. Each form has `fields` (id, type, label, required, options) and `rules` (show or hide fields based on answers). Changing a label or adding an option is a one-line edit. Old submissions keep the questions they were sent with.

Commit and push; Render redeploys automatically.

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
