import json
import math

from flask import Blueprint, render_template, request, redirect, url_for, flash, g, abort

import calc
from constants import STAND_SECTIONS, KIND_INPUTS, EOL_ROUTES
from db import q, ex, get_db
from helpers import login_required, fnum

bp = Blueprint("stands", __name__, url_prefix="/stands")

# Quick-start templates: quantities per m² of floor space (unless 'fixed').
# These are starting estimates only — edit them to match the real build.
TEMPLATES = {
    "custom": dict(
        label="Custom build (mostly single-use)",
        items=[
            ("materials", "MAT-MDF-18-M2", "Walls & joinery — MDF", 1.6, 1, 1, "landfill"),
            ("materials", "MAT-TIMBER-KG", "Timber framing", 6.0, 1, 1, "recycle"),
            ("materials", "MAT-PAINT-L", "Paint", 0.25, 1, 1, "none"),
            ("materials", "MAT-CARPET-NP-M2", "Exhibition carpet", 1.0, 1, 1, "landfill"),
            ("materials", "MAT-PVC-BANNER-M2", "Large-format graphics", 0.4, 1, 1, "landfill"),
            ("materials", "MAT-FOAMEX-5-M2", "Foam board signage", 0.15, 1, 1, "landfill"),
            ("materials", "MAT-STEEL-KG", "Steel structure / rigging", 2.0, 1, 5, "recycle"),
            ("logistics", "VEH-HGV-RIGID-KM", "Haulage to venue (one way km)", ("fixed", 200), ("perm2", 4 / 40, 4), 1, "none"),
            ("travel", "VEH-VAN-DIESEL-KM", "Crew van (one way km)", ("fixed", 200), ("fixed", 4), 1, "none"),
            ("travel", "HOTEL-UK-NIGHT", "Crew hotels (nights)", ("fixed", 4), ("perm2", 1 / 12, 2), 1, "none"),
            ("energy", "ELEC-UK-KWH", "Stand electricity (show days)", 15.0, 1, 1, "none"),
            ("waste", "WST-MIXED-LANDFILL-T", "Breakdown waste (residual)", 0.008, 1, 1, "none"),
        ]),
    "modular": dict(
        label="Modular / reusable system",
        items=[
            ("materials", "MAT-ALU-SYSTEM-KG", "Aluminium system frames", 4.0, 1, 30, "reuse"),
            ("materials", "MAT-SEG-FABRIC-M2", "Fabric graphics (SEG)", 1.4, 1, 3, "recycle"),
            ("materials", "MAT-PLY-18-M2", "Counters & plinths — plywood", 0.25, 1, 8, "reuse"),
            ("materials", "MAT-CARPET-TILE-M2", "Reusable carpet tiles", 1.0, 1, 10, "reuse"),
            ("logistics", "VEH-HGV-75T-KM", "Haulage to venue (one way km)", ("fixed", 200), ("perm2", 4 / 80, 4), 1, "none"),
            ("travel", "VEH-VAN-DIESEL-KM", "Crew van (one way km)", ("fixed", 200), ("fixed", 2), 1, "none"),
            ("travel", "HOTEL-UK-NIGHT", "Crew hotels (nights)", ("fixed", 2), ("perm2", 1 / 18, 1), 1, "none"),
            ("energy", "ELEC-UK-KWH", "Stand electricity (show days)", 12.0, 1, 1, "none"),
            ("waste", "WST-MIXED-RECYCLE-T", "Breakdown waste (recycled)", 0.002, 1, 1, "none"),
        ]),
}


def stand_factors():
    return q("SELECT * FROM factors WHERE active=1 AND module IN ('stand','both') ORDER BY kind, name")


def snapshot(f):
    return dict(ef_code=f["code"], ef_name=f["name"], ef_kind=f["kind"], ef_unit=f["unit"], ef_kg=f["kg_per_unit"],
                ef_wtt=f["wtt_per_unit"], ef_td=f["td_per_unit"], ef_mass=f["mass_kg_per_unit"],
                ef_source=f["source"])


def _resolve(v, size):
    if isinstance(v, tuple):
        if v[0] == "fixed":
            return float(v[1])
        if v[0] == "perm2":  # ("perm2", rate, minimum)
            return float(max(math.ceil(size * v[1]), v[2]))
    return float(v) * size


def apply_template(stand_id, key, size):
    t = TEMPLATES.get(key)
    if not t:
        return
    db = get_db()
    for n, (section, code, desc, qty, mult, uses, eol) in enumerate(t["items"]):
        f = q("SELECT * FROM factors WHERE code=?", (code,), one=True)
        if not f:
            continue
        quantity = _resolve(qty, size)
        multiplier = _resolve(mult, size) if isinstance(mult, tuple) else float(mult)
        vals = dict(stand_id=stand_id, section=section, factor_id=f["id"], description=desc,
                    quantity=round(quantity, 3), multiplier=multiplier, uses=uses, eol=eol, sort=n, **snapshot(f))
        db.execute(f"INSERT INTO stand_items({','.join(vals)}) VALUES({','.join(':' + k for k in vals)})", vals)
    db.commit()


# --------------------------------------------------------------------------

@bp.route("/")
@login_required()
def index():
    sql = "SELECT * FROM stands WHERE 1=1"
    args = []
    term = request.args.get("q", "").strip()
    if term:
        sql += " AND (client LIKE ? OR show_name LIKE ? OR ref LIKE ? OR venue LIKE ?)"
        args += [f"%{term}%"] * 4
    status = request.args.get("status")
    if status:
        sql += " AND status=?"
        args.append(status)
    sql += " ORDER BY COALESCE(open_date,'9999') DESC, id DESC"
    rows = []
    for s in q(sql, args):
        ss = calc.stand_summary(s["id"])
        rows.append(dict(s=s, total=ss["total"], per_m2=ss["per_m2"]))
    built = [r for r in rows if r["per_m2"]]
    avg_m2 = sum(r["per_m2"] for r in built) / len(built) if built else None
    return render_template("stands/index.html", rows=rows, avg_m2=avg_m2)


@bp.route("/new", methods=["GET", "POST"])
@bp.route("/<int:sid>/edit", methods=["GET", "POST"])
@login_required("editor")
def form(sid=None):
    s = q("SELECT * FROM stands WHERE id=?", (sid,), one=True) if sid else None
    if request.method == "POST":
        f = request.form
        if not f.get("client") or not f.get("show_name"):
            flash("Client and show are required.", "error")
        else:
            vals = (f.get("ref", "").strip(), f["client"].strip(), f["show_name"].strip(), f.get("venue", ""),
                    f.get("city", ""), f.get("country", ""), f.get("open_date") or None, fnum(f.get("size_m2")),
                    f.get("status", "estimate"), f.get("notes", ""))
            if s:
                ex("""UPDATE stands SET ref=?,client=?,show_name=?,venue=?,city=?,country=?,open_date=?,size_m2=?,
                      status=?,notes=?,updated_at=datetime('now') WHERE id=?""", vals + (sid,))
            else:
                sid = ex("""INSERT INTO stands(ref,client,show_name,venue,city,country,open_date,size_m2,status,notes,
                            created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)""", vals + (g.user["id"],))
                if f.get("template") in TEMPLATES and fnum(f.get("size_m2")):
                    apply_template(sid, f["template"], fnum(f.get("size_m2")))
                    flash("Stand created from the template. Adjust each line to match the real build.", "ok")
            return redirect(url_for("stands.detail", sid=sid))
    return render_template("stands/form.html", s=s, templates=TEMPLATES)


@bp.route("/<int:sid>")
@login_required()
def detail(sid):
    ss = calc.stand_summary(sid)
    if not ss["stand"]:
        abort(404)
    factors = stand_factors()
    fjson = {f["id"]: dict(kind=f["kind"], unit=f["unit"], mass=f["mass_kg_per_unit"]) for f in factors}
    recs = calc.stand_recommendations(ss)
    chart = dict(labels=[STAND_SECTIONS[k][0] for k in ss["by_section"]] + ["End of life"],
                 values=[round(v, 1) for v in ss["by_section"].values()] + [round(ss["eol_total"], 1)])
    return render_template("stands/detail.html", ss=ss, s=ss["stand"], factors=factors,
                           factors_json=json.dumps(fjson), kind_inputs=json.dumps(KIND_INPUTS),
                           eol_routes=EOL_ROUTES, recs=recs, chart=chart)


@bp.route("/<int:sid>/items", methods=["POST"])
@bp.route("/<int:sid>/items/<int:iid>", methods=["POST"])
@login_required("editor")
def item_save(sid, iid=None):
    f = q("SELECT * FROM factors WHERE id=?", (request.form.get("factor_id"),), one=True)
    qty = fnum(request.form.get("quantity"))
    section = request.form.get("section")
    if not f or qty is None or section not in STAND_SECTIONS:
        flash("Choose a factor and enter a quantity.", "error")
        return redirect(url_for("stands.detail", sid=sid))
    vals = dict(stand_id=sid, section=section, factor_id=f["id"],
                description=request.form.get("description", "").strip(), quantity=qty,
                multiplier=fnum(request.form.get("multiplier"), 1) or 1,
                uses=max(fnum(request.form.get("uses"), 1) or 1, 1),
                eol=request.form.get("eol", "none") if section == "materials" else "none", **snapshot(f))
    if iid:
        ex(f"UPDATE stand_items SET {','.join(k + '=:' + k for k in vals)} WHERE id=:id AND stand_id=:stand_id",
           dict(vals, id=iid))
    else:
        ex(f"INSERT INTO stand_items({','.join(vals)}) VALUES({','.join(':' + k for k in vals)})", vals)
    ex("UPDATE stands SET updated_at=datetime('now') WHERE id=?", (sid,))
    return redirect(url_for("stands.detail", sid=sid) + f"#{section}")


@bp.route("/<int:sid>/items/<int:iid>/delete", methods=["POST"])
@login_required("editor")
def item_delete(sid, iid):
    it = q("SELECT section FROM stand_items WHERE id=? AND stand_id=?", (iid, sid), one=True)
    ex("DELETE FROM stand_items WHERE id=? AND stand_id=?", (iid, sid))
    return redirect(url_for("stands.detail", sid=sid) + (f"#{it['section']}" if it else ""))


@bp.route("/<int:sid>/duplicate", methods=["POST"])
@login_required("editor")
def duplicate(sid):
    s = q("SELECT * FROM stands WHERE id=?", (sid,), one=True)
    new = ex("""INSERT INTO stands(ref,client,show_name,venue,city,country,open_date,size_m2,status,notes,created_by)
                VALUES(?,?,?,?,?,?,?,?, 'estimate', ?, ?)""",
             ("", s["client"], s["show_name"] + " (copy)", s["venue"], s["city"], s["country"], None, s["size_m2"],
              s["notes"], g.user["id"]))
    db = get_db()
    db.execute("""INSERT INTO stand_items(stand_id,section,factor_id,description,quantity,multiplier,uses,eol,ef_code,
                  ef_name,ef_kind,ef_unit,ef_kg,ef_wtt,ef_td,ef_mass,ef_source,sort)
                  SELECT ?,section,factor_id,description,quantity,multiplier,uses,eol,ef_code,ef_name,ef_kind,ef_unit,
                  ef_kg,ef_wtt,ef_td,ef_mass,ef_source,sort FROM stand_items WHERE stand_id=?""", (new, sid))
    db.commit()
    flash("Stand duplicated — useful for a rebuild of the same design at another show.", "ok")
    return redirect(url_for("stands.form", sid=new))


@bp.route("/<int:sid>/delete", methods=["POST"])
@login_required("editor")
def delete(sid):
    ex("DELETE FROM stands WHERE id=?", (sid,))
    flash("Stand deleted.", "ok")
    return redirect(url_for("stands.index"))


@bp.route("/<int:sid>/report")
@login_required()
def report(sid):
    ss = calc.stand_summary(sid)
    if not ss["stand"]:
        abort(404)
    recs = calc.stand_recommendations(ss)
    chart = dict(labels=[STAND_SECTIONS[k][0] for k in ss["by_section"]] + ["End of life"],
                 values=[round(v, 1) for v in ss["by_section"].values()] + [round(ss["eol_total"], 1)])
    return render_template("reports/stand_report.html", ss=ss, s=ss["stand"], recs=recs, chart=chart,
                           eol_routes=EOL_ROUTES)
