"""All emissions calculations. Everything is computed in kgCO2e."""
from collections import defaultdict, OrderedDict

from constants import CATEGORIES, STAND_SECTIONS, STAND_TO_CATEGORY
from db import q

WOOD_PREFIXES = ("MAT-MDF", "MAT-PLY", "MAT-CHIP", "MAT-TIMBER", "MAT-HONEYCOMB", "MAT-PAPER", "MAT-CARDBOARD")
METAL_PREFIXES = ("MAT-ALU", "MAT-STEEL", "MAT-DIBOND")
CARPET_PREFIXES = ("MAT-CARPET",)


def f0(x):
    try:
        return float(x or 0)
    except (TypeError, ValueError):
        return 0.0


# --------------------------------------------------------------------------
# Company activities
# --------------------------------------------------------------------------

def activity_parts(a):
    """Return (direct_kg, upstream_kg, market_direct_kg) for one activity row."""
    qty = f0(a["quantity"])
    direct = qty * f0(a["ef_kg"])
    upstream = qty * (f0(a["ef_wtt"]) + f0(a["ef_td"]))
    market = direct
    if a["category"].startswith("s2") and a["renewable"]:
        market = 0.0
    return direct, upstream, market


def scope_of(cat):
    return CATEGORIES.get(cat, (3,))[0]


def stands_in_period(period):
    return q("""SELECT * FROM stands WHERE open_date >= ? AND open_date <= ?
                AND status IN ('built','final') ORDER BY open_date""",
             (period["start_date"], period["end_date"]))


def summarise_period(period, include_stands=None):
    if period is None:
        return None
    if include_stands is None:
        include_stands = bool(period["include_stands"])
    acts = q("""SELECT a.*, s.name AS site_name FROM activities a
                LEFT JOIN sites s ON s.id = a.site_id WHERE a.period_id=?""", (period["id"],))

    by_cat = defaultdict(float)
    by_site = defaultdict(float)
    by_month = defaultdict(float)
    by_quality = defaultdict(float)
    scope2_market = 0.0
    energy = OrderedDict([("Natural gas", 0.0), ("Electricity", 0.0),
                          ("Transport fuel", 0.0), ("Other fuels", 0.0)])
    rows = []
    for a in acts:
        direct, upstream, market = activity_parts(a)
        by_cat[a["category"]] += direct
        if upstream:
            by_cat["s3_c3_fuel_energy"] += upstream
        if a["category"].startswith("s2"):
            scope2_market += market
        total = direct + upstream
        by_site[a["site_name"] or "Unassigned"] += total
        month = (a["activity_date"] or period["start_date"])[:7]
        by_month[month] += total
        by_quality[a["data_quality"]] += total
        kwh = f0(a["quantity"]) * f0(a["ef_kwh"])
        code = a["ef_code"] or ""
        in_secr = scope_of(a["category"]) in (1, 2) or (
            a["category"] == "s3_c6_business_travel" and code.startswith("TRV-CAR"))
        if kwh and in_secr:
            if code.startswith("FUEL-GAS"):
                energy["Natural gas"] += kwh
            elif a["category"].startswith("s2"):
                energy["Electricity"] += kwh
            elif a["category"] in ("s1_mobile", "s3_c6_business_travel"):
                energy["Transport fuel"] += kwh
            else:
                energy["Other fuels"] += kwh
        rows.append(dict(id=a["id"], name=a["description"] or a["ef_name"], category=a["category"],
                         kg=total, site=a["site_name"]))

    stand_rows = []
    stands_total = 0.0
    if include_stands:
        for s in stands_in_period(period):
            ss = stand_summary(s["id"])
            stand_rows.append(dict(id=s["id"], name=f'{s["client"]} — {s["show_name"]}', kg=ss["total"],
                                   open_date=s["open_date"]))
            stands_total += ss["total"]
            for sec, kg in ss["by_section"].items():
                by_cat[STAND_TO_CATEGORY[sec]] += kg
            by_cat[STAND_TO_CATEGORY["eol"]] += ss["eol_total"]
            by_site["Stands (projects)"] += ss["total"]
            by_month[(s["open_date"] or period["start_date"])[:7]] += ss["total"]
            by_quality["stand calculator"] += ss["total"]

    by_scope = {1: 0.0, 2: 0.0, 3: 0.0}
    for cat, kg in by_cat.items():
        by_scope[scope_of(cat)] += kg
    total = sum(by_scope.values())
    revenue = f0(period["revenue_gbp"])
    fte = f0(period["employees_fte"])
    cat_sorted = sorted(((c, kg) for c, kg in by_cat.items() if kg), key=lambda x: -x[1])
    return dict(
        period=period, total=total, by_scope=by_scope, by_cat=dict(by_cat), cat_sorted=cat_sorted,
        scope2_market=scope2_market,
        by_site=dict(sorted(by_site.items(), key=lambda x: -x[1])),
        by_month=dict(sorted(by_month.items())), by_quality=dict(by_quality),
        energy=energy, energy_total=sum(energy.values()),
        per_m_revenue=(total / 1000) / (revenue / 1_000_000) if revenue else None,
        per_fte=(total / 1000) / fte if fte else None,
        top=_top_sources(rows, stand_rows), activity_count=len(acts),
        stands=stand_rows, stands_total=stands_total,
    )


def _top_sources(rows, stand_rows, n=8):
    """Group repeated monthly lines (same description, category and site) and rank with stands."""
    grouped = OrderedDict()
    for r in rows:
        key = (r["name"], r["category"], r["site"])
        if key not in grouped:
            grouped[key] = dict(r, count=0, kg=0.0)
        grouped[key]["kg"] += r["kg"]
        grouped[key]["count"] += 1
    out = list(grouped.values()) + [dict(name=s["name"], category="stand", kg=s["kg"], site=None, count=1,
                                         stand_id=s["id"], open_date=s["open_date"]) for s in stand_rows]
    return sorted(out, key=lambda r: -r["kg"])[:n]


def coverage_total(summary, coverage):
    if not summary:
        return 0.0
    s = summary["by_scope"]
    return s[1] + s[2] + (s[3] if coverage == "s123" else 0)


# --------------------------------------------------------------------------
# Stand calculator
# --------------------------------------------------------------------------

def eol_factor_code(ef_code, route):
    code = ef_code or ""
    if route == "landfill":
        if code.startswith(WOOD_PREFIXES):
            return "WST-WOOD-LANDFILL-T"
        if code.startswith(CARPET_PREFIXES):
            return "WST-CARPET-LANDFILL-T"
        if code.startswith(("MAT-ACRYLIC", "MAT-FOAMEX", "MAT-PVC", "MAT-LDPE", "MAT-SEG")):
            return "WST-PLASTIC-LANDFILL-T"
        return "WST-MIXED-LANDFILL-T"
    if route == "recycle":
        if code.startswith(WOOD_PREFIXES):
            return "WST-WOOD-RECYCLE-T"
        if code.startswith(METAL_PREFIXES):
            return "WST-METAL-RECYCLE-T"
        return "WST-MIXED-RECYCLE-T"
    if route == "efw":
        return "WST-MIXED-EFW-T"
    return None


def eol_factor(code):
    if not code:
        return 0.0
    row = q("SELECT kg_per_unit FROM factors WHERE code=?", (code,), one=True)
    return f0(row["kg_per_unit"]) if row else 0.0


def item_emissions(it):
    uses = max(f0(it["uses"]), 1.0)
    per_unit = f0(it["ef_kg"]) + f0(it["ef_wtt"]) + f0(it["ef_td"])
    base = f0(it["quantity"]) * f0(it["multiplier"] or 1) * per_unit / uses
    eol = 0.0
    if it["section"] == "materials" and it["eol"] in ("landfill", "recycle", "efw") and it["ef_mass"]:
        tonnes = f0(it["quantity"]) * f0(it["ef_mass"]) / 1000.0 / uses
        eol = tonnes * eol_factor(eol_factor_code(it["ef_code"], it["eol"]))
    return base, eol


def stand_summary(stand_id):
    stand = q("SELECT * FROM stands WHERE id=?", (stand_id,), one=True)
    items = q("SELECT * FROM stand_items WHERE stand_id=? ORDER BY section, sort, id", (stand_id,))
    by_section = OrderedDict((k, 0.0) for k in STAND_SECTIONS)
    eol_total = 0.0
    rows = []
    material_mass = 0.0
    single_use_kg = 0.0
    for it in items:
        base, eol = item_emissions(it)
        by_section[it["section"]] += base
        eol_total += eol
        if it["section"] == "materials":
            material_mass += f0(it["quantity"]) * f0(it["ef_mass"])
            if f0(it["uses"]) <= 1:
                single_use_kg += base + eol
        rows.append(dict(item=it, kg=base, eol=eol, total=base + eol))
    total = sum(by_section.values()) + eol_total
    size = f0(stand["size_m2"]) if stand else 0
    return dict(stand=stand, items=rows, by_section=by_section, eol_total=eol_total, total=total,
                per_m2=total / size if size else None, material_mass=material_mass,
                single_use_kg=single_use_kg,
                top=sorted(rows, key=lambda r: -r["total"])[:6])


# --------------------------------------------------------------------------
# Recommendations (rule based, transparent)
# --------------------------------------------------------------------------

def stand_recommendations(ss):
    recs = []
    total = ss["total"] or 0
    if not total:
        return recs
    items = ss["items"]

    def add(title, text, saving=None):
        recs.append(dict(title=title, text=text, saving=saving))

    if ss["single_use_kg"] / total > 0.3:
        add("Design for reuse",
            f"Single-use materials make up {ss['single_use_kg'] / total:.0%} of this stand's footprint. "
            "Moving walls, frames and flooring to a reusable system and amortising them over 5+ shows "
            "would cut most of that.", ss["single_use_kg"] * 0.8)

    alu = [r for r in items if (r["item"]["ef_code"] or "") in ("MAT-ALU-KG", "MAT-ALU-SYSTEM-KG")
           and f0(r["item"]["uses"]) < 10]
    if alu:
        kg = sum(r["kg"] for r in alu)
        add("Specify recycled aluminium or keep frames in service longer",
            "Virgin-heavy aluminium has roughly double the footprint of high recycled-content extrusions. "
            "Either specify recycled content or keep system frames in your hire stock for more shows.",
            kg * 0.5)

    landfill = [r for r in items if r["item"]["eol"] == "landfill"]
    if landfill:
        kg = sum(r["eol"] for r in landfill)
        add("Divert build waste from landfill",
            "Some materials are going to landfill after the show. Wood and board landfill releases "
            "methane; segregated recycling or reuse removes most of this end-of-life impact.", kg * 0.95)

    gen = [r for r in items if (r["item"]["ef_code"] or "") in ("FUEL-GASOIL-L", "FUEL-DIESEL-L")
           and r["item"]["section"] == "energy"]
    if gen:
        litres = sum(f0(r["item"]["quantity"]) * f0(r["item"]["multiplier"]) for r in gen)
        add("Switch generators to HVO or a grid connection",
            "HVO renewable diesel cuts generator emissions by around 85% with no equipment change.",
            litres * ((2.758 + 0.64) - (0.0356 + 0.48)))

    flights = [r for r in items if (r["item"]["ef_code"] or "").startswith("TRV-FLY-SH")
               or (r["item"]["ef_code"] or "") == "TRV-FLY-DOM-PKM"]
    if flights:
        kg = sum(r["kg"] for r in flights)
        add("Swap short flights for rail",
            "Short-haul and domestic flights emit 20–40× more per passenger km than international rail.",
            kg * 0.9)

    single_graphics = [r for r in items if (r["item"]["ef_code"] or "") in ("MAT-PVC-BANNER-M2", "MAT-FOAMEX-5-M2")]
    if single_graphics:
        add("Move graphics to fabric or recyclable board",
            "PVC banner and foam board are hard to recycle. Printed tension fabric on reusable frames, or "
            "recyclable paper-based boards, lower both the material and disposal impact.",
            sum(r["total"] for r in single_graphics) * 0.4)

    carpet = [r for r in items if (r["item"]["ef_code"] or "") == "MAT-CARPET-NP-M2" and f0(r["item"]["uses"]) <= 1]
    if carpet:
        add("Replace single-use carpet",
            "Needlepunch exhibition carpet is usually used once. Reusable carpet tiles or a raised floor with a "
            "reusable finish pays back after a few shows.", sum(r["total"] for r in carpet) * 0.6)

    artics = [r for r in items if (r["item"]["ef_code"] or "") in ("VEH-HGV-ARTIC-KM", "VEH-HGV-RIGID-KM")]
    if artics and ss["by_section"]["logistics"] / total > 0.15:
        add("Consolidate loads",
            "Haulage is a large share here. Flat-pack design and shared loads with other projects heading to the "
            "same venue reduce vehicle journeys.", ss["by_section"]["logistics"] * 0.25)

    recs.sort(key=lambda r: -(r["saving"] or 0))
    return recs


def company_recommendations(summary):
    recs = []
    if not summary or not summary["total"]:
        return recs
    cat = summary["by_cat"]
    total = summary["total"]

    def add(title, text, category, saving):
        recs.append(dict(title=title, text=text, category=category, saving=saving))

    elec = cat.get("s2_electricity", 0)
    if elec and summary["scope2_market"] > 0.5 * elec:
        add("Move to a renewable electricity tariff",
            "Switching to a REGO-backed renewable tariff reduces market-based Scope 2 emissions to near zero. "
            "On-site solar on the workshop roof cuts location-based emissions too.",
            "s2_electricity", summary["scope2_market"])
    gas = cat.get("s1_stationary", 0)
    if gas > 0.05 * total:
        add("Electrify heating", "Replacing gas heating with heat pumps typically cuts heating emissions by "
            "60–70% at current UK grid intensity.", "s1_stationary", gas * 0.65)
    mob = cat.get("s1_mobile", 0)
    if mob > 0.05 * total:
        add("Electrify the van fleet", "Electric vans emit roughly 70% less per km than diesel on the UK grid. "
            "Start with vans on regular short routes.", "s1_mobile", mob * 0.7)
    travel = cat.get("s3_c6_business_travel", 0)
    if travel > 0.1 * total:
        add("Set a travel policy", "Rail-first for journeys under 5 hours, economy class for flights, and "
            "shared crew transport to shows.", "s3_c6_business_travel", travel * 0.25)
    mat = cat.get("s3_c1_purchased", 0)
    if mat > 0.3 * total:
        add("Grow reusable stand stock", "Purchased materials dominate. A reusable modular system, hire stock "
            "and design-for-disassembly standards will reduce materials bought per stand.",
            "s3_c1_purchased", mat * 0.3)
    waste = cat.get("s3_c5_waste", 0) + cat.get("s3_c12_end_of_life", 0)
    if waste > 0.03 * total:
        add("Zero waste to landfill", "Segregate wood, metal and plastics at breakdown and use a contractor "
            "with a zero-to-landfill guarantee.", "s3_c5_waste", waste * 0.9)
    recs.sort(key=lambda r: -r["saving"])
    return recs
