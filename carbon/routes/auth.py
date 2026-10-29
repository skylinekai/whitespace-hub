from flask import Blueprint, render_template, request, redirect, url_for, session, flash, g
from werkzeug.security import generate_password_hash, check_password_hash

from db import q, ex
from helpers import login_required

bp = Blueprint("auth", __name__)


@bp.route("/setup", methods=["GET", "POST"])
def setup():
    if q("SELECT 1 FROM users LIMIT 1"):
        return redirect(url_for("auth.login"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        pw = request.form.get("password", "")
        if not name or "@" not in email or len(pw) < 10:
            flash("Enter your name, a valid email and a password of at least 10 characters.", "error")
        else:
            uid = ex("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,'admin')",
                     (email, name, generate_password_hash(pw)))
            session.clear()
            session["uid"] = uid
            session.permanent = True
            flash("Admin account created. Start by adding a reporting period and your sites.", "ok")
            return redirect(url_for("company.dashboard"))
    return render_template("auth/setup.html")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        user = q("SELECT * FROM users WHERE email=? AND active=1", (email,), one=True)
        if user and check_password_hash(user["password_hash"], request.form.get("password", "")):
            csrf = session.get("csrf")
            session.clear()
            session["csrf"] = csrf
            session["uid"] = user["id"]
            session.permanent = True
            nxt = request.args.get("next") or ""
            return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else url_for("company.dashboard"))
        flash("Email or password not recognised.", "error")
    return render_template("auth/login.html")


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


@bp.route("/account", methods=["GET", "POST"])
@login_required()
def account():
    if request.method == "POST":
        if not check_password_hash(g.user["password_hash"], request.form.get("current", "")):
            flash("Current password is wrong.", "error")
        elif len(request.form.get("new", "")) < 10:
            flash("New password must be at least 10 characters.", "error")
        else:
            ex("UPDATE users SET password_hash=? WHERE id=?",
               (generate_password_hash(request.form["new"]), g.user["id"]))
            flash("Password updated.", "ok")
            return redirect(url_for("auth.account"))
    return render_template("auth/account.html")
