from flask import Blueprint, render_template, redirect, url_for, flash

import calc
from constants import CATEGORIES
from db import q, setting
from helpers import login_required, current_period

bp = Blueprint("reports", __name__, url_prefix="/reports")


def _context():
    p = current_period()
    if not p:
        return None
    s = calc.summarise_period(p)
    prev = q("SELECT * FROM periods WHERE start_date < ? ORDER BY start_date DESC LIMIT 1", (p["start_date"],), one=True)
    ps = calc.summarise_period(prev) if prev else None
    done = q("SELECT * FROM actions WHERE status IN ('done','in_progress') ORDER BY status, title")
    notes = {k: setting(k + "_note", "") for k in ("methodology", "boundary", "exclusions")}
    return dict(p=p, s=s, prev=prev, ps=ps, actions_done=done, factor_set=setting("factor_set", ""), notes=notes,
                company_number=setting("company_number", ""), contact=setting("reporting_contact", ""),
                sites=q("SELECT * FROM sites WHERE active=1 ORDER BY name"))


@bp.route("/")
@login_required()
def index():
    return render_template("reports/index.html")


@bp.route("/secr")
@login_required()
def secr():
    ctx = _context()
    if not ctx:
        flash("Create a reporting period first.", "info")
        return redirect(url_for("company.periods"))
    s = ctx["s"]
    # SECR emissions: Scope 1, Scope 2 and Scope 3 grey-fleet business mileage only
    grey = 0.0
    for a in q("SELECT * FROM activities WHERE period_id=? AND category='s3_c6_business_travel' "
               "AND ef_code LIKE 'TRV-CAR%'", (ctx["p"]["id"],)):
        d, u, _ = calc.activity_parts(a)
        grey += d
    ctx["grey"] = grey
    ctx["secr_total"] = s["by_scope"][1] + s["by_scope"][2] + grey
    if ctx["ps"]:
        pg = 0.0
        for a in q("SELECT * FROM activities WHERE period_id=? AND category='s3_c6_business_travel' "
                   "AND ef_code LIKE 'TRV-CAR%'", (ctx["prev"]["id"],)):
            pg += calc.activity_parts(a)[0]
        ctx["prev_grey"] = pg
        ctx["prev_total"] = ctx["ps"]["by_scope"][1] + ctx["ps"]["by_scope"][2] + pg
    rev = ctx["p"]["revenue_gbp"]
    ctx["intensity"] = (ctx["secr_total"] / 1000) / (rev / 1e6) if rev else None
    return render_template("reports/secr.html", **ctx)


@bp.route("/inventory")
@login_required()
def inventory():
    ctx = _context()
    if not ctx:
        flash("Create a reporting period first.", "info")
        return redirect(url_for("company.periods"))
    ctx["all_cats"] = CATEGORIES
    return render_template("reports/inventory.html", **ctx)
