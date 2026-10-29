import os
import secrets
from urllib.parse import unquote

from werkzeug.security import generate_password_hash

from flask import Flask, session, request, redirect, url_for, g, abort, flash
from werkzeug.middleware.proxy_fix import ProxyFix

import db as dbm
from helpers import login_required, can_edit, current_period
from constants import CATEGORIES, SCOPE_LABELS, SCOPE_COLOURS, KIND_LABELS, STAND_SECTIONS


HUB_SIGN_IN = os.environ.get("CARBON_TRUST_HUB") == "1"


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY") or "dev-only-change-me",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("FLASK_ENV") != "development" and bool(os.environ.get("RENDER")),
        MAX_CONTENT_LENGTH=20 * 1024 * 1024,
        PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14,
        SESSION_COOKIE_NAME="swc_session",
        SESSION_COOKIE_PATH=(os.environ.get("CARBON_PREFIX") or "/").rstrip("/") or "/",
    )

    with app.app_context():
        dbm.init_db(dbm.db_path())
    app.teardown_appcontext(dbm.close_db)

    @app.before_request
    def load_user_and_csrf():
        g.user = None
        if HUB_SIGN_IN:
            return hub_user()
        uid = session.get("uid")
        if uid:
            g.user = dbm.q("SELECT * FROM users WHERE id=? AND active=1", (uid,), one=True)
            if not g.user:
                session.clear()
        if "csrf" not in session:
            session["csrf"] = secrets.token_hex(16)
        if request.method == "POST":
            token = request.form.get("_csrf") or request.headers.get("X-CSRF")
            if token != session.get("csrf"):
                abort(400, "Your session expired. Go back, refresh the page and try again.")
        # first run → setup screen
        if request.endpoint not in ("auth.setup", "static") and not dbm.q("SELECT 1 FROM users LIMIT 1"):
            return redirect(url_for("auth.setup"))

    def hub_user():
        """Inside Whitespace Hub: the hub has already signed the person in and tells us who they are.
        Only the hub can reach this app (it listens on 127.0.0.1), and the hub strips these
        headers from browser requests before setting them."""
        if request.endpoint == "static":
            return None
        email = (request.headers.get("X-Hub-User-Email") or "").strip().lower()
        if not email:
            return redirect("/login")
        name = unquote(request.headers.get("X-Hub-User-Name") or "").strip() or email
        role = "admin" if request.headers.get("X-Hub-User-Role") == "admin" else "viewer"
        user = dbm.q("SELECT * FROM users WHERE email=?", (email,), one=True)
        if not user:
            dbm.ex("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)",
                   (email, name, generate_password_hash(secrets.token_hex(24)), role))
        elif user["role"] != role or user["name"] != name or not user["active"]:
            dbm.ex("UPDATE users SET role=?, name=?, active=1 WHERE id=?", (role, name, user["id"]))
        g.user = dbm.q("SELECT * FROM users WHERE email=?", (email,), one=True)
        session["uid"] = g.user["id"]
        session.permanent = True
        if "csrf" not in session:
            session["csrf"] = secrets.token_hex(16)
        # sign-in, sign-out, accounts and users are handled by the hub
        if request.endpoint in ("auth.login", "auth.setup", "auth.account", "admin.users"):
            return redirect("/admin#users" if request.endpoint == "admin.users" else "/")
        if request.endpoint == "auth.logout":
            return redirect("/logout")
        if request.method == "POST":
            token = request.form.get("_csrf") or request.headers.get("X-CSRF")
            if token != session.get("csrf"):
                abort(400, "Your session expired. Go back, refresh the page and try again.")
        return None

    @app.context_processor
    def inject():
        periods = dbm.q("SELECT * FROM periods ORDER BY start_date DESC") if g.get("user") else []
        current = current_period()
        return dict(
            csrf=session.get("csrf"), user=g.get("user"), can_edit=can_edit(),
            periods_nav=periods, current_period=current, org_name=dbm.setting("org_name", "Skyline Whitespace"),
            CATEGORIES=CATEGORIES, SCOPE_LABELS=SCOPE_LABELS, SCOPE_COLOURS=SCOPE_COLOURS,
            KIND_LABELS=KIND_LABELS, STAND_SECTIONS=STAND_SECTIONS,
            typekit=os.environ.get("TYPEKIT_KIT_ID"), hub=HUB_SIGN_IN, ai_enabled=bool(os.environ.get("ANTHROPIC_API_KEY")),
        )

    @app.template_filter("t")
    def tonnes(kg, dp=1):
        """kg → tonnes string."""
        if kg is None:
            return "—"
        v = kg / 1000.0
        if abs(v) < 10 and dp == 1:
            dp = 2
        return f"{v:,.{dp}f}"

    @app.template_filter("num")
    def num(v, dp=0):
        if v is None or v == "":
            return "—"
        try:
            return f"{float(v):,.{dp}f}"
        except (TypeError, ValueError):
            return v

    @app.template_filter("pct")
    def pct(v, total):
        return f"{(v / total * 100):.0f}%" if total else "—"

    @app.route("/period/<int:pid>")
    @login_required()
    def switch_period(pid):
        session["period_id"] = pid
        return redirect(request.referrer or url_for("company.dashboard"))

    @app.errorhandler(403)
    def forbidden(_e):
        flash("You don't have permission to do that. Ask an admin to change your role.", "error")
        return redirect(url_for("company.dashboard"))

    from routes.auth import bp as auth_bp
    from routes.company import bp as company_bp
    from routes.stands import bp as stands_bp
    from routes.library import bp as library_bp
    from routes.reports import bp as reports_bp
    from routes.admin import bp as admin_bp
    for bp in (auth_bp, company_bp, stands_bp, library_bp, reports_bp, admin_bp):
        app.register_blueprint(bp)

    @app.route("/healthz")
    def healthz():
        return "ok"

    return app


class PrefixMiddleware:
    """Serve the app under a sub-path (e.g. /carbon) when it runs inside Whitespace Hub."""

    def __init__(self, wsgi_app, prefix):
        self.wsgi_app, self.prefix = wsgi_app, prefix

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path == self.prefix or path.startswith(self.prefix + "/"):
            environ["SCRIPT_NAME"] = self.prefix
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"
        return self.wsgi_app(environ, start_response)


app = create_app()
# Requests arrive from the hub's server, which passes on the visitor's address and https
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
_prefix = (os.environ.get("CARBON_PREFIX") or "").rstrip("/")
if _prefix:
    app.wsgi_app = PrefixMiddleware(app.wsgi_app, _prefix)

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
