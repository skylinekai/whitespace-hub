"""Load demo data so you can explore the app.  Usage:  python demo_data.py

Creates two reporting periods with sample activity data, two sites, a target,
some actions and three stand footprints. Safe to run once on an empty install;
it refuses to run if any reporting periods already exist.
"""
import os
import random
import sys

from app import create_app
from db import q, ex, get_db
from helpers import factor_snapshot

app = create_app()
random.seed(7)

MONTH_END = ["01-31", "02-28", "03-31", "04-30", "05-31", "06-30", "07-31", "08-31", "09-30", "10-31", "11-30", "12-31"]


def f(code):
    return q("SELECT * FROM factors WHERE code=?", (code,), one=True)


def add(pid, site, code, qty, desc, date, cat=None, renewable=0, dq="actual", ev=""):
    fac = f(code)
    vals = dict(period_id=pid, site_id=site, category=cat or fac["default_category"], factor_id=fac["id"],
                description=desc, activity_date=date, quantity=round(qty, 2), unit=fac["unit"], renewable=renewable,
                data_quality=dq, evidence=ev, **factor_snapshot(fac))
    get_db().execute(f"INSERT INTO activities({','.join(vals)}) VALUES({','.join(':' + k for k in vals)})", vals)


with app.app_context():
    if q("SELECT 1 FROM periods LIMIT 1"):
        sys.exit("Periods already exist — demo data not loaded.")
    office = ex("INSERT INTO sites(name,site_type,address,floor_area_m2) VALUES('Head office','Office','Ipswich',420)")
    works = ex("INSERT INTO sites(name,site_type,address,floor_area_m2) VALUES('Workshop','Workshop / production','Ipswich',2600)")
    p1 = ex("INSERT INTO periods(name,start_date,end_date,revenue_gbp,employees_fte) VALUES('FY2025','2025-01-01','2025-12-31',8400000,46)")
    p2 = ex("INSERT INTO periods(name,start_date,end_date,revenue_gbp,employees_fte) VALUES('FY2026','2026-01-01','2026-12-31',9100000,49)")

    for pid, year, scale, months, green in ((p1, 2025, 1.0, 12, 0), (p2, 2026, 0.93, 9, 1)):
        for m in range(months):
            d = f"{year}-{MONTH_END[m]}"
            winter = 1.6 if m in (0, 1, 2, 10, 11) else 0.7
            add(pid, works, "ELEC-UK-KWH", 9800 * scale * random.uniform(.9, 1.1), "Workshop electricity", d, renewable=green, ev="Octopus Energy")
            add(pid, office, "ELEC-UK-KWH", 2100 * scale * random.uniform(.9, 1.1), "Office electricity", d, renewable=green, ev="Octopus Energy")
            add(pid, works, "FUEL-GAS-KWH", 14000 * winter * scale * random.uniform(.9, 1.1), "Workshop heating gas", d, ev="British Gas")
            add(pid, None, "FUEL-DIESEL-L", 1150 * scale * random.uniform(.8, 1.2), "Fuel card — vans & trucks", d, ev="Allstar fuel card")
            add(pid, None, "TRV-CAR-GREY-KM", 2600 * random.uniform(.7, 1.3), "Mileage claims", d, ev="Expenses")
            add(pid, works, "WST-MIXED-LANDFILL-T" if year == 2025 else "WST-MIXED-RECYCLE-T", 3.2 * random.uniform(.8, 1.2), "Workshop skips", d, ev="Waste transfer note")
            add(pid, works, "WST-WOOD-RECYCLE-T", 2.1 * random.uniform(.8, 1.2), "Wood waste — chipped", d, ev="Waste transfer note")
            if m % 3 == 1:
                add(pid, None, "TRV-FLY-SH-ECO-PKM", 6400 * random.uniform(.7, 1.3), "Crew flights to European shows", d, dq="estimated", ev="Travel bookings")
                add(pid, None, "HOTEL-DE-NIGHT", 38 * random.uniform(.8, 1.2), "Crew hotels — Germany", d, ev="Travel bookings")
                add(pid, None, "TRV-RAIL-PKM", 3100, "Rail travel", d, ev="Trainline")
            add(pid, None, "SPEND-IT", 2400, "Software & IT services", d, dq="spend", ev="Xero")
            add(pid, None, "SPEND-PROF", 3800, "Professional services", d, dq="spend", ev="Xero")
        add(pid, works, "REF-R410A-KG", 1.5, "Air-con top-up", f"{year}-06-30", ev="F-gas log")
    get_db().commit()

    ex("INSERT INTO targets(name,base_period_id,target_year,reduction_pct,coverage) VALUES('Near-term SBTi-aligned target',?,2030,42,'s12')", (p1,))
    for t, cat, red, status, owner in [
        ("Switch to a renewable electricity tariff", "s2_electricity", 30, "done", "Operations"),
        ("Replace two diesel vans with electric", "s1_mobile", 9, "in_progress", "Fleet"),
        ("Workshop heat pump feasibility", "s1_stationary", 28, "planned", "Facilities"),
        ("Rail-first travel policy", "s3_c6_business_travel", 4, "idea", "HR"),
    ]:
        ex("INSERT INTO actions(title,category,est_reduction_t,status,owner,due_date) VALUES(?,?,?,?,?,?)",
           (t, cat, red, status, owner, "2026-12-31"))

    from routes.stands import apply_template
    for client, show, venue, city, date, size, tpl, status in [
        ("Northwind Robotics", "Automatica", "Messe München", "Munich", "2026-06-24", 120, "custom", "built"),
        ("Halden Foods", "IFE London", "ExCeL London", "London", "2026-03-23", 48, "modular", "final"),
        ("Corvel Medical", "Arab Health", "Dubai World Trade Centre", "Dubai", "2027-01-26", 72, "custom", "estimate"),
    ]:
        sid = ex("INSERT INTO stands(client,show_name,venue,city,open_date,size_m2,status,ref) VALUES(?,?,?,?,?,?,?,?)",
                 (client, show, venue, city, date, size, status, f"SW-{random.randint(2400, 2999)}"))
        apply_template(sid, tpl, size)
    print("Demo data loaded.")
