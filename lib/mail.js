// Email alerts for new submissions. Works with any SMTP server, including Microsoft 365.
const fs = require('fs');
const path = require('path');

let transport = null;
function getTransport() {
  if (transport !== null) return transport;
  if (!process.env.SMTP_HOST) { transport = false; return false; }
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

function recipients(formId) {
  let map = {};
  try { map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'notify.json'), 'utf8')); } catch { }
  const entry = map[formId];
  const list = Array.isArray(entry) ? entry : (entry && entry.emails) || [];
  const fallback = (process.env.NOTIFY_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function notify(form, saved, answers, files) {
  const t = getTransport();
  const to = recipients(form.id);
  if (!t || !to.length) return { sent: false, reason: !t ? 'SMTP not set up' : 'no recipients' };
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const rows = answers.filter(a => a.value).map(a =>
    `<tr><td style="padding:6px 12px 6px 0;color:#616161;vertical-align:top;width:40%">${esc(a.label)}</td><td style="padding:6px 0;color:#242424">${esc(a.value).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;max-width:680px">
    <div style="background:#0F6CBD;color:#fff;padding:14px 18px;font-size:16px;font-weight:600">${esc(form.name)} · ${saved.ref}</div>
    <div style="padding:16px 18px;border:1px solid #e0e0e0;border-top:0">
      <table style="border-collapse:collapse;width:100%">${rows}</table>
      ${files.length ? `<p style="color:#616161">${files.length} file(s) attached.</p>` : ''}
      ${base ? `<p><a href="${base}/admin#s-${saved.id}" style="color:#0F6CBD">Open in Whitespace Hub</a></p>` : ''}
    </div></div>`;
  const small = files.reduce((n, f) => n + f.buffer.length, 0) < 15 * 1024 * 1024;
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: to.join(', '),
    subject: `${form.name} – ${saved.ref}`,
    html,
    attachments: small ? files.map(f => ({ filename: f.filename, content: f.buffer, contentType: f.mime })) : []
  });
  return { sent: true };
}

// A task was assigned to someone: tell them by email (if email is set up).
async function taskAssigned(task, to, by) {
  const t = getTransport();
  if (!t || !to || !to.email) return { sent: false };
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;max-width:600px">
    <div style="background:#0F6CBD;color:#fff;padding:14px 18px;font-size:16px;font-weight:600">New task for you</div>
    <div style="padding:16px 18px;border:1px solid #e0e0e0;border-top:0">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600">${esc(task.title)}</p>
      ${task.notes ? `<p style="margin:0 0 8px;color:#424242">${esc(task.notes).replace(/\n/g, '<br>')}</p>` : ''}
      ${task.due ? `<p style="margin:0 0 8px;color:#616161">Due ${esc(new Date(task.due + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</p>` : ''}
      <p style="margin:0;color:#616161">Assigned by ${esc(by)}</p>
      ${base ? `<p><a href="${base}/#home" style="color:#0F6CBD">Open Whitespace Hub</a></p>` : ''}
    </div></div>`;
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: to.email, subject: `New task: ${task.title}`, html });
  return { sent: true };
}

// Jack (or whoever answers questions) replied to someone's Helpful HR question.
async function questionAnswered(to, staffName, question, reply, ticketId) {
  const t = getTransport();
  if (!t || !to || !to.email) return { sent: false };
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;max-width:600px">
    <div style="background:#0F6CBD;color:#fff;padding:14px 18px;font-size:16px;font-weight:600">${esc(staffName)} replied to your question</div>
    <div style="padding:16px 18px;border:1px solid #e0e0e0;border-top:0">
      <p style="margin:0 0 6px;color:#616161">You asked:</p><p style="margin:0 0 14px">${esc(question).replace(/\n/g, '<br>')}</p>
      <p style="margin:0 0 6px;color:#616161">${esc(staffName)} said:</p><p style="margin:0 0 14px">${esc(reply).replace(/\n/g, '<br>')}</p>
      ${base ? `<p><a href="${base}/#hhr/${encodeURIComponent(ticketId)}" style="color:#0F6CBD">Reply in Whitespace Hub</a></p>` : ''}
    </div></div>`;
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: to.email, subject: `${staffName} replied to your question`, html });
  return { sent: true };
}

module.exports = { notify, recipients, taskAssigned, questionAnswered };
