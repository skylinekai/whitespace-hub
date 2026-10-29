import csv
import io

from flask import Blueprint, render_template, request, redirect, url_for, flash, Response

from constants import CATEGORIES, KIND_LABELS
from db import q, ex, get_db, set_setting, setting
from helpers import login_required, fnum
import importer

bp = Blueprint("library", __name__, url_prefix="/factors")

FIELDS = ["code", "name", "kind", "default_category", "unit", "kg_per_unit", "wtt_per_unit", "td_per_unit",
          "mass_kg_per_unit", "kwh_per_unit", "module", "source", "notes", "active"]


@bp.route("/")
@login_required()
def index():
    sql = "SELECT * FROM factors WHERE 1=1"
    args = []
    kind = request.args.get("kind")
    if kind:
        sql += " AND kind=?"
        args.append(kind)
    term = request.args.get("q", "").strip()
    if term:
        sql += " AND (name LIKE ? OR code LIKE ?)"
        args += [f"%{term}%"] * 2
    sql += " ORDER BY kind, name"
    return render_template("library/index.html", factors=q(sql, args), factor_set=setting("factor_set", ""))


@bp.route("/new", methods=["GET", "POST"])
@bp.route("/<int:fid>/edit", methods=["GET", "POST"])
@login_required("admin")
def form(fid=None):
    f = q("SELECT * FROM factors WHERE id=?", (fid,), one=True) if fid else None
    if request.method == "POST":
        d = request.form
        vals = dict(code=d.get("code", "").strip().upper(), name=d.get("name", "").strip(), kind=d.get("kind"),
                    default_category=d.get("default_category"), unit=d.get("unit", "").strip(),
                    kg_per_unit=fnum(d.get("kg_per_unit")), wtt_per_unit=fnum(d.get("wtt_per_unit"), 0),
                    td_per_unit=fnum(d.get("td_per_unit"), 0), mass_kg_per_unit=fnum(d.get("mass_kg_per_unit")),
                    kwh_per_unit=fnum(d.get("kwh_per_unit")), module=d.get("module", "both"),
                    source=d.get("source", ""), notes=d.get("notes", ""), active=1 if d.get("active") else 0)
        if not vals["code"] or not vals["name"] or vals["kg_per_unit"] is None or not vals["unit"]:
            flash("Code, name, unit and kgCO2e per unit are required.", "error")
        elif q("SELECT 1 FROM factors WHERE code=? AND id!=?", (vals["code"], fid or 0), one=True):
            flash("That code is already used by another factor.", "error")
        else:
            if f:
                ex(f"UPDATE factors SET {','.join(k + '=:' + k for k in vals)}, updated_at=datetime('now') "
                   "WHERE id=:id", dict(vals, id=fid))
            else:
                ex(f"INSERT INTO factors({','.join(vals)}) VALUES({','.join(':' + k for k in vals)})", vals)
            flash("Factor saved. Existing activities keep the value they were calculated with until you re-apply "
                  "factors to a period.", "ok")
            return redirect(url_for("library.index"))
    return render_template("library/form.html", f=f, kinds=KIND_LABELS, cats=CATEGORIES)


@bp.route("/export.csv")
@login_required()
def export():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(FIELDS)
    for f in q("SELECT * FROM factors ORDER BY kind, code"):
        w.writerow([f[k] for k in FIELDS])
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=emission-factors.csv"})


@bp.route("/import", methods=["POST"])
@login_required("admin")
def import_factors():
    up = request.files.get("file")
    if not up or not up.filename:
        flash("Choose a CSV or Excel file exported from this page.", "error")
        return redirect(url_for("library.index"))
    try:
        rows = importer.read_table(up.filename, up.read())
    except Exception as e:  # noqa: BLE001
        flash(f"Couldn't read that file: {e}", "error")
        return redirect(url_for("library.index"))
    db = get_db()
    added = updated = skipped = 0
    for r in rows:
        code = (r.get("code") or "").strip().upper()
        kg = fnum(r.get("kg_per_unit"))
        if not code or kg is None or not r.get("name") or not r.get("unit"):
            skipped += 1
            continue
        kind = r.get("kind") if r.get("kind") in KIND_LABELS else "spend"
        cat = r.get("default_category") if r.get("default_category") in CATEGORIES else "s3_c1_purchased"
        vals = dict(code=code, name=r["name"], kind=kind, default_category=cat, unit=r["unit"], kg_per_unit=kg,
                    wtt_per_unit=fnum(r.get("wtt_per_unit"), 0), td_per_unit=fnum(r.get("td_per_unit"), 0),
                    mass_kg_per_unit=fnum(r.get("mass_kg_per_unit")), kwh_per_unit=fnum(r.get("kwh_per_unit")),
                    module=r.get("module") if r.get("module") in ("company", "stand", "both") else "both",
                    source=r.get("source", ""), notes=r.get("notes", ""),
                    active=0 if str(r.get("active", "1")).strip() in ("0", "no", "false") else 1)
        if db.execute("SELECT 1 FROM factors WHERE code=?", (code,)).fetchone():
            db.execute(f"UPDATE factors SET {','.join(k + '=:' + k for k in vals)}, updated_at=datetime('now') "
                       "WHERE code=:code", vals)
            updated += 1
        else:
            db.execute(f"INSERT INTO factors({','.join(vals)}) VALUES({','.join(':' + k for k in vals)})", vals)
            added += 1
    db.commit()
    if request.form.get("factor_set"):
        set_setting("factor_set", request.form["factor_set"])
    flash(f"Factor library updated: {added} added, {updated} updated, {skipped} skipped.", "ok")
    return redirect(url_for("library.index"))
