"""Starter emission-factor library.

Values are kgCO2e per unit. They are a STARTER set:
  * UK fuels, electricity, travel, freight, waste: based on the UK Government
    (DESNZ) GHG conversion factors 2025, rounded. DESNZ publishes a new set every
    June; update them in the app (Emission factors > Import) each year.
  * Materials: cradle-to-gate values in line with the ICE database (Circular
    Ecology / University of Bath), excluding biogenic carbon storage.
  * Overseas grid electricity and hotels: indicative national averages.
  * Spend factors: indicative UK input-output style values (kgCO2e per GBP).
Every factor is editable in the app, and each activity stores a snapshot of the
factor it used so historic results stay auditable.

Fields:
  code, name, kind, default_category, unit, kg (direct), wtt (well-to-tank),
  td (electricity transmission & distribution), mass (kg per unit, materials),
  kwh (energy content per unit, for SECR energy totals), module, source
"""

DESNZ = "DESNZ 2025 (approx.)"
ICE = "ICE v3 (approx.)"
IND = "Indicative"

F = []


def add(code, name, kind, cat, unit, kg, wtt=0.0, td=0.0, mass=None, kwh=None,
        module="both", source=DESNZ):
    F.append(dict(code=code, name=name, kind=kind, default_category=cat, unit=unit,
                  kg_per_unit=kg, wtt_per_unit=wtt, td_per_unit=td,
                  mass_kg_per_unit=mass, kwh_per_unit=kwh, module=module,
                  source=source))


# ---------------- Fuels (Scope 1 stationary / generators) ----------------
add("FUEL-GAS-KWH", "Natural gas (gross CV)", "fuel", "s1_stationary", "kWh", 0.18290, 0.03020, kwh=1.0, module="company")
add("FUEL-DIESEL-L", "Diesel (average biofuel blend)", "fuel", "s1_mobile", "litre", 2.51200, 0.61100, kwh=10.8)
add("FUEL-PETROL-L", "Petrol (average biofuel blend)", "fuel", "s1_mobile", "litre", 2.07000, 0.60000, kwh=9.6)
add("FUEL-GASOIL-L", "Gas oil / red diesel (generators)", "fuel", "s1_stationary", "litre", 2.75800, 0.64000, kwh=10.9)
add("FUEL-HVO-L", "HVO renewable diesel (generators)", "fuel", "s1_stationary", "litre", 0.03560, 0.48000, kwh=9.6)
add("FUEL-LPG-L", "LPG", "fuel", "s1_stationary", "litre", 1.55700, 0.18000, kwh=7.0)
add("FUEL-KEROSENE-L", "Burning oil / kerosene", "fuel", "s1_stationary", "litre", 2.54000, 0.53000, kwh=10.4, module="company")

# ---------------- Refrigerants (Scope 1 fugitive, per kg leaked) ----------------
add("REF-R410A-KG", "Refrigerant R410A leaked", "refrigerant", "s1_fugitive", "kg", 2088, module="company")
add("REF-R32-KG", "Refrigerant R32 leaked", "refrigerant", "s1_fugitive", "kg", 675, module="company")
add("REF-R134A-KG", "Refrigerant R134a leaked", "refrigerant", "s1_fugitive", "kg", 1430, module="company")
add("REF-R404A-KG", "Refrigerant R404A leaked", "refrigerant", "s1_fugitive", "kg", 3922, module="company")

# ---------------- Company vehicles (Scope 1 mobile, per km) ----------------
add("VEH-CAR-AVG-KM", "Car, average (unknown fuel)", "vehicle_km", "s1_mobile", "km", 0.16700, 0.04200, kwh=0.63)
add("VEH-CAR-DIESEL-KM", "Car, average diesel", "vehicle_km", "s1_mobile", "km", 0.16800, 0.04100, kwh=0.64)
add("VEH-CAR-PETROL-KM", "Car, average petrol", "vehicle_km", "s1_mobile", "km", 0.16300, 0.04700, kwh=0.66)
add("VEH-CAR-HYBRID-KM", "Car, hybrid", "vehicle_km", "s1_mobile", "km", 0.11900, 0.03400, kwh=0.48)
add("VEH-CAR-BEV-KM", "Car, battery electric (UK grid)", "vehicle_km", "s2_electricity", "km", 0.04200, 0.01000, 0.0037, kwh=0.24)
add("VEH-VAN-DIESEL-KM", "Van, average diesel (up to 3.5t)", "vehicle_km", "s1_mobile", "km", 0.25000, 0.06100, kwh=0.94)
add("VEH-VAN-BEV-KM", "Van, battery electric (UK grid)", "vehicle_km", "s2_electricity", "km", 0.07500, 0.01700, 0.0066, kwh=0.42)
add("VEH-HGV-75T-KM", "HGV rigid 3.5–7.5t (Luton / 7.5t), diesel", "vehicle_km", "s3_c4_upstream_transport", "km", 0.55000, 0.13400, kwh=2.1)
add("VEH-HGV-RIGID-KM", "HGV rigid, average diesel", "vehicle_km", "s3_c4_upstream_transport", "km", 0.80000, 0.19500, kwh=3.0)
add("VEH-HGV-ARTIC-KM", "HGV articulated, average diesel", "vehicle_km", "s3_c4_upstream_transport", "km", 0.93000, 0.22700, kwh=3.5)

# ---------------- Freight (per tonne.km) ----------------
add("FRT-ROAD-TKM", "Road freight, HGV average", "freight_tkm", "s3_c4_upstream_transport", "tonne.km", 0.10700, 0.02600)
add("FRT-SEA-TKM", "Sea freight, container ship average", "freight_tkm", "s3_c4_upstream_transport", "tonne.km", 0.01600, 0.00300)
add("FRT-AIR-LH-TKM", "Air freight, long-haul (incl. RF)", "freight_tkm", "s3_c4_upstream_transport", "tonne.km", 1.00000, 0.11000)
add("FRT-AIR-SH-TKM", "Air freight, short-haul (incl. RF)", "freight_tkm", "s3_c4_upstream_transport", "tonne.km", 2.10000, 0.24000)
add("FRT-RAIL-TKM", "Rail freight", "freight_tkm", "s3_c4_upstream_transport", "tonne.km", 0.02800, 0.00600)

# ---------------- Electricity (Scope 2, per kWh) ----------------
add("ELEC-UK-KWH", "Electricity, UK grid", "electricity", "s2_electricity", "kWh", 0.17700, 0.04100, 0.01560, kwh=1.0)
add("ELEC-DE-KWH", "Electricity, Germany grid", "electricity", "s2_electricity", "kWh", 0.38000, 0.06000, 0.02000, kwh=1.0, source=IND)
add("ELEC-FR-KWH", "Electricity, France grid", "electricity", "s2_electricity", "kWh", 0.05600, 0.01000, 0.00400, kwh=1.0, source=IND)
add("ELEC-NL-KWH", "Electricity, Netherlands grid", "electricity", "s2_electricity", "kWh", 0.33000, 0.05500, 0.01500, kwh=1.0, source=IND)
add("ELEC-ES-KWH", "Electricity, Spain grid", "electricity", "s2_electricity", "kWh", 0.15000, 0.03000, 0.01200, kwh=1.0, source=IND)
add("ELEC-IT-KWH", "Electricity, Italy grid", "electricity", "s2_electricity", "kWh", 0.28000, 0.05000, 0.01500, kwh=1.0, source=IND)
add("ELEC-AE-KWH", "Electricity, UAE grid", "electricity", "s2_electricity", "kWh", 0.42000, 0.07000, 0.03000, kwh=1.0, source=IND)
add("ELEC-US-KWH", "Electricity, USA grid", "electricity", "s2_electricity", "kWh", 0.37000, 0.06000, 0.02000, kwh=1.0, source=IND)
add("WATER-M3", "Water supply", "water", "s3_c1_purchased", "m³", 0.15000, module="company")

# ---------------- Business travel / commuting (per passenger.km) ----------------
add("TRV-RAIL-PKM", "Rail, national", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.03540, 0.00900)
add("TRV-EUROSTAR-PKM", "Rail, Eurostar / international", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.00450, 0.00100)
add("TRV-TUBE-PKM", "London Underground", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.02780, 0.00700)
add("TRV-BUS-PKM", "Bus, average local", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.10200, 0.02500)
add("TRV-TAXI-PKM", "Taxi, regular", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.14900, 0.03600)
add("TRV-CAR-GREY-KM", "Car, employee-owned / hire (grey fleet)", "vehicle_km", "s3_c6_business_travel", "km", 0.16700, 0.04200, kwh=0.63)
add("TRV-FLY-DOM-PKM", "Flight, UK domestic (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.27200, 0.03000)
add("TRV-FLY-SH-ECO-PKM", "Flight, short-haul economy (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.15100, 0.01700)
add("TRV-FLY-SH-BUS-PKM", "Flight, short-haul business (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.22700, 0.02500)
add("TRV-FLY-LH-ECO-PKM", "Flight, long-haul economy (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.14800, 0.01600)
add("TRV-FLY-LH-PREM-PKM", "Flight, long-haul premium economy (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.23700, 0.02600)
add("TRV-FLY-LH-BUS-PKM", "Flight, long-haul business (incl. RF)", "passenger_km", "s3_c6_business_travel", "passenger.km", 0.43000, 0.04700)

# ---------------- Hotels (per room night) ----------------
add("HOTEL-UK-NIGHT", "Hotel stay, UK", "hotel", "s3_c6_business_travel", "room night", 10.4)
add("HOTEL-DE-NIGHT", "Hotel stay, Germany", "hotel", "s3_c6_business_travel", "room night", 13.2, source=IND)
add("HOTEL-FR-NIGHT", "Hotel stay, France", "hotel", "s3_c6_business_travel", "room night", 6.9, source=IND)
add("HOTEL-NL-NIGHT", "Hotel stay, Netherlands", "hotel", "s3_c6_business_travel", "room night", 14.6, source=IND)
add("HOTEL-ES-NIGHT", "Hotel stay, Spain", "hotel", "s3_c6_business_travel", "room night", 7.0, source=IND)
add("HOTEL-IT-NIGHT", "Hotel stay, Italy", "hotel", "s3_c6_business_travel", "room night", 12.0, source=IND)
add("HOTEL-AE-NIGHT", "Hotel stay, UAE", "hotel", "s3_c6_business_travel", "room night", 52.0, source=IND)
add("HOTEL-US-NIGHT", "Hotel stay, USA", "hotel", "s3_c6_business_travel", "room night", 16.1, source=IND)

# ---------------- Waste (per tonne) ----------------
add("WST-MIXED-LANDFILL-T", "Mixed commercial waste, landfill", "waste", "s3_c5_waste", "tonne", 467.0)
add("WST-MIXED-EFW-T", "Mixed commercial waste, energy from waste", "waste", "s3_c5_waste", "tonne", 21.3)
add("WST-MIXED-RECYCLE-T", "Mixed recycling", "waste", "s3_c5_waste", "tonne", 21.3)
add("WST-WOOD-LANDFILL-T", "Wood, landfill", "waste", "s3_c5_waste", "tonne", 828.0)
add("WST-WOOD-RECYCLE-T", "Wood, recycled / chipped", "waste", "s3_c5_waste", "tonne", 21.3)
add("WST-PLASTIC-LANDFILL-T", "Plastics, landfill", "waste", "s3_c5_waste", "tonne", 9.0)
add("WST-METAL-RECYCLE-T", "Metals, recycled", "waste", "s3_c5_waste", "tonne", 21.3)
add("WST-CARPET-LANDFILL-T", "Carpet, landfill", "waste", "s3_c5_waste", "tonne", 167.0)

# ---------------- Stand / build materials ----------------
# kg = kgCO2e per unit; mass = kg of material per unit (used for end-of-life)
add("MAT-MDF-18-M2", "MDF board 18mm", "material", "s3_c1_purchased", "m²", 5.27, mass=13.5, source=ICE)
add("MAT-MDF-KG", "MDF", "material", "s3_c1_purchased", "kg", 0.39, mass=1.0, source=ICE)
add("MAT-PLY-18-M2", "Plywood 18mm", "material", "s3_c1_purchased", "m²", 7.35, mass=10.8, source=ICE)
add("MAT-CHIP-18-M2", "Chipboard 18mm", "material", "s3_c1_purchased", "m²", 4.68, mass=11.7, source=ICE)
add("MAT-TIMBER-KG", "Softwood timber (sawn)", "material", "s3_c1_purchased", "kg", 0.263, mass=1.0, source=ICE)
add("MAT-HONEYCOMB-M2", "Paper honeycomb board 10mm", "material", "s3_c1_purchased", "m²", 1.90, mass=2.0, source=IND)
add("MAT-ALU-KG", "Aluminium (world average, virgin-heavy)", "material", "s3_c1_purchased", "kg", 13.0, mass=1.0, source=ICE)
add("MAT-ALU-REC-KG", "Aluminium (high recycled content)", "material", "s3_c1_purchased", "kg", 6.0, mass=1.0, source=IND)
add("MAT-ALU-SYSTEM-KG", "Aluminium system frame (e.g. modular extrusion)", "material", "s3_c1_purchased", "kg", 13.0, mass=1.0, source=ICE)
add("MAT-STEEL-KG", "Steel, general", "material", "s3_c1_purchased", "kg", 1.55, mass=1.0, source=ICE)
add("MAT-GLASS-10-M2", "Toughened glass 10mm", "material", "s3_c1_purchased", "m²", 41.75, mass=25.0, source=ICE)
add("MAT-ACRYLIC-5-M2", "Acrylic sheet 5mm", "material", "s3_c1_purchased", "m²", 39.0, mass=6.0, source=IND)
add("MAT-FOAMEX-5-M2", "PVC foam board 5mm", "material", "s3_c1_purchased", "m²", 8.50, mass=2.75, source=IND)
add("MAT-DIBOND-3-M2", "Aluminium composite panel 3mm", "material", "s3_c1_purchased", "m²", 17.0, mass=3.8, source=IND)
add("MAT-HPL-M2", "HPL laminate 0.8mm", "material", "s3_c1_purchased", "m²", 1.60, mass=1.15, source=IND)
add("MAT-SEG-FABRIC-M2", "Printed polyester tension fabric (SEG)", "material", "s3_c1_purchased", "m²", 2.00, mass=0.25, source=IND)
add("MAT-PVC-BANNER-M2", "Printed PVC banner / vinyl graphic", "material", "s3_c1_purchased", "m²", 2.00, mass=0.50, source=IND)
add("MAT-CARPET-NP-M2", "Exhibition carpet, needlepunch", "material", "s3_c1_purchased", "m²", 3.40, mass=0.50, source=IND)
add("MAT-CARPET-TILE-M2", "Carpet tiles (nylon)", "material", "s3_c1_purchased", "m²", 9.00, mass=4.0, source=IND)
add("MAT-PAINT-L", "Paint, water-based emulsion", "material", "s3_c1_purchased", "litre", 3.80, mass=1.3, source=ICE)
add("MAT-PAPER-KG", "Printed paper / literature", "material", "s3_c1_purchased", "kg", 1.00, mass=1.0, source=IND)
add("MAT-CARDBOARD-KG", "Cardboard packaging", "material", "s3_c1_purchased", "kg", 0.82, mass=1.0, source=DESNZ)
add("MAT-LDPE-KG", "Plastic film / stretch wrap", "material", "s3_c1_purchased", "kg", 2.60, mass=1.0, source=IND)

# ---------------- Spend-based (per GBP, indicative) ----------------
for code, name, val in [
    ("SPEND-PRINT", "Printing & reproduction", 0.40),
    ("SPEND-TIMBER", "Timber & wood products", 0.62),
    ("SPEND-METAL", "Fabricated metal products", 0.55),
    ("SPEND-PLASTIC", "Plastic products", 0.66),
    ("SPEND-FURNITURE", "Furniture (purchase or hire)", 0.42),
    ("SPEND-AV", "Electronics & AV equipment / hire", 0.30),
    ("SPEND-PROF", "Professional services (legal, finance, consulting)", 0.10),
    ("SPEND-IT", "IT services & software", 0.12),
    ("SPEND-MARKETING", "Advertising & marketing services", 0.15),
    ("SPEND-HOTEL", "Hotels & accommodation", 0.25),
    ("SPEND-CATERING", "Food & catering", 0.55),
    ("SPEND-FREIGHT", "Road freight & courier services", 0.70),
    ("SPEND-WASTE", "Waste management services", 0.95),
    ("SPEND-OFFICE", "Office supplies & consumables", 0.45),
    ("SPEND-SUBCON", "Subcontracted build / labour services", 0.20),
]:
    add(code, name + " (spend)", "spend", "s3_c1_purchased", "GBP", val, source=IND)

FACTORS = F
