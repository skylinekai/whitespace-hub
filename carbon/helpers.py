from functools import wraps

from flask import g, redirect, url_for, request, abort, session

import db as dbm

ROLE_ORDER = {"viewer": 0, "editor": 1, "admin": 2}


def login_required(role=None):
    """role='editor' allows editor+admin; role='admin' allows admin only."""
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if not g.get("user"):
                return redirect(url_for("auth.login", next=request.path))
            if role and ROLE_ORDER[g.user["role"]] < ROLE_ORDER[role]:
                abort(403)
            return fn(*a, **kw)
        return wrapper
    return deco


def can_edit():
    return g.get("user") is not None and g.user["role"] in ("admin", "editor")


def current_period():
    if not g.get("user"):
        return None
    pid = session.get("period_id")
    p = dbm.q("SELECT * FROM periods WHERE id=?", (pid,), one=True) if pid else None
    if not p:
        p = dbm.q("SELECT * FROM periods ORDER BY start_date DESC LIMIT 1", one=True)
        if p:
            session["period_id"] = p["id"]
    return p


def fnum(v, default=None):
    """Parse a form number; tolerant of commas and £."""
    if v is None:
        return default
    s = str(v).replace(",", "").replace("£", "").strip()
    if s == "":
        return default
    try:
        return float(s)
    except ValueError:
        return default


def factor_snapshot(f):
    return dict(ef_code=f["code"], ef_name=f["name"], ef_kg=f["kg_per_unit"], ef_wtt=f["wtt_per_unit"],
                ef_td=f["td_per_unit"], ef_kwh=f["kwh_per_unit"], ef_source=f["source"])
