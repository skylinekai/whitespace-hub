# Whitespace Hub

The staff hub for forms, policies and documents, with all 53 forms rebuilt so they no longer need Jotform.

- **Hub** (`/`): departments, search, favourites and every form, styled like Outlook on the web.
- **Forms** (`/#form/<id>`): the same questions and show/hide rules as the Jotform versions, with file uploads, signatures, star ratings, product pickers and drafts that save on the device.
- **Submissions** (`/admin`): an Outlook-style inbox. Forms are folders; open a submission to read it, see photos and signatures, mark it done, print it or download a CSV.

## Put it live on Render

The quickest way is the Blueprint, which creates the web service **and** its database together.

1. Push this folder to your GitHub repo (replace the old files).
2. In Render choose **New → Blueprint**, pick the repo and confirm. It creates:
   - `whitespace-hub` (web service, Starter plan)
   - `whitespace-hub-db` (Postgres, Basic plan) — this is where submissions and uploads are kept.
3. Render will ask for the values marked *sync: false*. Fill in at least:
   | Setting | What to put |
   |---|---|
   | `ADMIN_PASSWORD` | The password for the Submissions dashboard. Share it only with people who should see submissions. |
   | `PUBLIC_URL` | The site address, e.g. `https://whitespace-hub.onrender.com` (used for links in emails). |
   | `NOTIFY_EMAILS` | Who gets emailed about new submissions, comma separated. |
   | `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | The mailbox that sends the emails (see below). |
4. Deploy. Visit `/admin`, sign in, and send a test form.

Already have a web service? In its **Environment** tab add the same settings, create a Postgres database in Render (**New → Postgres**) and paste its *Internal Database URL* into `DATABASE_URL`.

> Without `DATABASE_URL` the app saves submissions to the server's own disk. That is fine for trying it out, but Render wipes that disk on every deploy, so always connect Postgres for real use. The dashboard shows a warning until you do.

## Email alerts (Microsoft 365)

The defaults in `render.yaml` point at Microsoft 365 (`smtp.office365.com`, port 587).

1. Use a mailbox such as `forms@skylinewhitespace.com` and put it in `SMTP_USER` and `MAIL_FROM`.
2. Ask your Microsoft 365 admin to turn on **Authenticated SMTP** for that mailbox (Microsoft 365 admin centre → Users → the mailbox → Mail → Manage email apps).
3. Put its password (or an app password if it uses multi-factor sign-in) in `SMTP_PASS`.

Each email shows every answer and attaches the uploaded files and signature (when they total under 15 MB), with a link straight to the submission.

**Different recipients per form:** edit `notify.json`. Every form is listed by name; add addresses to its `emails` list. Forms left empty go to `NOTIFY_EMAILS`.

## Changing content

- **Hub sections, documents and links:** `public/hub-data.js`. Each item is one line:
  `['f', 'Title', '<form id>']` form · `['d', 'Title', '~File.pdf']` document · `['l', 'Title', 'https://…']` link · `['n', '<p>Text</p>']` note.
- **Form questions:** `public/forms.json`. Each form has `fields` (id, type, label, required, options) and `rules` (show or hide fields based on answers). Changing a label or adding an option is a one-line edit. Old submissions keep the questions they were sent with.

Commit and push; Render redeploys automatically.

## Good to know

- Forms are public so clients and suppliers can fill in the supplier, customer and handover forms. The dashboard needs the password.
- Some forms collect bank details, National Insurance numbers and health information. Keep the dashboard password private, and delete submissions you no longer need.
- Documents (policies, certificates, logos) still link to files hosted on Jotform. Move them before you close the Jotform account; ask Claude to bring them into the app.
- Old Jotform submissions stay in Jotform. Export them there if you want a record.
- Run it locally with `npm install` then `ADMIN_PASSWORD=test npm start`, and open http://localhost:3000.
