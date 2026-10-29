import secrets

from flask import Blueprint, render_template, request, redirect, url_for, flash, g
from werkzeug.security import generate_password_hash

from constants import ROLES
from db import q, ex, set_setting, setting
from helpers import login_required

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/users", methods=["GET", "POST"])
@login_required("admin")
def users():
    temp = None
    if request.method == "POST":
        f = request.form
        action = f.get("action")
        if action == "add":
            email = f.get("email", "").strip().lower()
            if "@" not in email or not f.get("name"):
                flash("Name and a valid email are required.", "error")
            elif q("SELECT 1 FROM users WHERE email=?", (email,), one=True):
                flash("That email already has an account.", "error")
            else:
                temp = secrets.token_urlsafe(9)
                ex("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)",
                   (email, f["name"].strip(), generate_password_hash(temp),
                    f.get("role") if f.get("role") in ROLES else "viewer"))
                flash(f"User added. Send {email} their temporary password below; they can change it under Account.", "ok")
                temp = (email, temp)
        elif action in ("role", "toggle", "reset"):
            uid = int(f.get("id"))
            if uid == g.user["id"] and action != "reset":
                flash("You can't change your own role or deactivate yourself.", "error")
            elif action == "role" and f.get("role") in ROLES:
                ex("UPDATE users SET role=? WHERE id=?", (f["role"], uid))
                flash("Role updated.", "ok")
            elif action == "toggle":
                ex("UPDATE users SET active = 1 - active WHERE id=?", (uid,))
                flash("User updated.", "ok")
            elif action == "reset":
                pw = secrets.token_urlsafe(9)
                ex("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(pw), uid))
                u = q("SELECT email FROM users WHERE id=?", (uid,), one=True)
                temp = (u["email"], pw)
                flash("Password reset.", "ok")
    return render_template("admin/users.html", users=q("SELECT * FROM users ORDER BY active DESC, name"),
                           roles=ROLES, temp=temp)


@bp.route("/settings", methods=["GET", "POST"])
@login_required("admin")
def settings():
    keys = ["org_name", "company_number", "reporting_contact", "methodology_note", "boundary_note", "exclusions_note"]
    if request.method == "POST":
        for k in keys:
            set_setting(k, request.form.get(k, "").strip())
        flash("Settings saved.", "ok")
        return redirect(url_for("admin.settings"))
    return render_template("admin/settings.html", vals={k: setting(k, "") for k in keys})
