# Skyline Whitespace Carbon

Internal carbon platform for Skyline Whitespace, modelled on Greenly's carbon assessment product and extended for exhibition stands.

## What it does

**Company footprint (Scopes 1–3)**
- Reporting periods (financial years) with turnover and FTE for intensity ratios; lock a period once reported
- Sites (office, workshop, warehouse) for site breakdowns
- Activity data entry with live CO₂e preview, evidence references and data-quality flags
- Spreadsheet import (Excel/CSV template with factor-code lookup sheet) with a review step
- **AI import** (optional): upload a bill, fuel card statement, invoice or travel report (PDF, image, Excel); Claude maps each line to an emission factor for you to review
- Automatic Scope 3 Category 3 (well-to-tank + grid losses), location- and market-based Scope 2 (REGO-backed renewable tariffs)
- Dashboard: totals by scope and category, monthly trend, largest sources, year-on-year change, intensity
- Targets (base year, % reduction, Scope 1+2 or 1–3) with trajectory chart, action plan, and rule-based reduction suggestions you can add to the plan with one click

**Stand footprints**
- Per-stand calculator: materials & graphics, haulage, crew travel & hotels, on-site energy, on-site waste
- Reuse built in: each material is spread across the number of shows it serves
- End-of-life: reuse / recycle / energy from waste / landfill, with material-specific disposal factors
- Quick-start templates (custom single-use build, modular reusable system) scaled to stand size
- kgCO₂e per m² benchmarking across all stands, duplicate a stand for a rebuild
- Branded one-page **client report** (print / save as PDF) with breakdown, equivalents and reduction options
- Built/Final stands roll into the company Scope 3 automatically (Cat 1, 4, 5, 6, 12)

**Reporting**
- SECR disclosure (energy kWh, Scope 1/2/grey fleet, intensity ratio, methodology, efficiency actions, prior year)
- Full GHG inventory by GHG Protocol category, site and stand
- Excel export of every activity with the factor snapshot used (audit trail)

**Admin**
- Users with admin / editor / viewer roles, temporary passwords, password reset
- Editable emission factor library with CSV/Excel import and export; "Re-apply factors" per period

## Running it

This copy runs inside Whitespace Hub at `/carbon` — see the main `README.md` in the folder above for deployment. The first visit asks you to create the admin account.

## Emission factors — please read

The starter library (`factors_seed.py`) is based on the UK Government (DESNZ) 2025 conversion factors, the ICE database for materials, and indicative values for overseas grids, hotels and spend. Values are rounded and some are approximations. Before you report externally:

1. Check the key factors against the official DESNZ set — the **2026 set is already published** and the UK electricity factor fell by roughly a quarter.
2. Update via **Emission factors → Export CSV**, edit values (keep the codes), **Import**, then **Reporting periods → Re-apply factors**.
3. Replace "Indicative" material factors with supplier EPDs where you have them.

## Structure

```
app.py            Flask app factory, CSRF, filters
db.py             SQLite schema and helpers
calc.py           All calculations and recommendations
importer.py       Spreadsheet import and AI extraction
factors_seed.py   Starter emission factor library
constants.py      GHG categories, stand sections, labels
routes/           auth, company, stands, library (factors), reports, admin
templates/        Jinja templates
static/           CSS, JS (Chart.js loaded from cdnjs), logos
```
