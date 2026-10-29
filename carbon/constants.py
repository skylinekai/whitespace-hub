"""Shared labels and mappings."""

# GHG Protocol categories used for company activities
CATEGORIES = {
    "s1_stationary": (1, "Stationary combustion", "Gas, oil, LPG burned in buildings or generators you control"),
    "s1_mobile": (1, "Company vehicles", "Fuel used by cars, vans and trucks you own or lease"),
    "s1_fugitive": (1, "Refrigerant leaks", "Air-conditioning and refrigeration top-ups"),
    "s2_electricity": (2, "Purchased electricity", "Electricity bought for offices, workshops, EV charging"),
    "s2_heat": (2, "Purchased heat & steam", "District heating"),
    "s3_c1_purchased": (3, "Cat 1 · Purchased goods & services", "Materials, services, subcontractors"),
    "s3_c2_capital": (3, "Cat 2 · Capital goods", "Machinery, vehicles, IT hardware bought"),
    "s3_c3_fuel_energy": (3, "Cat 3 · Fuel & energy related", "Well-to-tank and grid losses (calculated automatically)"),
    "s3_c4_upstream_transport": (3, "Cat 4 · Upstream transport", "Haulage and freight you pay for"),
    "s3_c5_waste": (3, "Cat 5 · Waste", "Waste from workshops, offices and builds"),
    "s3_c6_business_travel": (3, "Cat 6 · Business travel", "Flights, rail, hotels, grey-fleet mileage"),
    "s3_c7_commuting": (3, "Cat 7 · Employee commuting", "Staff travel to work and homeworking"),
    "s3_c9_downstream_transport": (3, "Cat 9 · Downstream transport", "Delivery paid for by customers"),
    "s3_c12_end_of_life": (3, "Cat 12 · End of life of sold products", "Disposal of stands after shows"),
}

SCOPE_LABELS = {1: "Scope 1", 2: "Scope 2", 3: "Scope 3"}
SCOPE_COLOURS = {1: "#0F6CBD", 2: "#038387", 3: "#6BB700"}

KIND_LABELS = {
    "fuel": "Fuel",
    "refrigerant": "Refrigerant",
    "vehicle_km": "Vehicle distance",
    "freight_tkm": "Freight (tonne.km)",
    "electricity": "Electricity",
    "water": "Water",
    "passenger_km": "Passenger travel",
    "hotel": "Hotel",
    "waste": "Waste",
    "material": "Material",
    "spend": "Spend-based",
}

# How quantity / multiplier are labelled for each kind (stand calculator)
KIND_INPUTS = {
    "material": ("Quantity", "Shows it will be used for"),
    "vehicle_km": ("Distance per journey (km)", "Number of journeys"),
    "freight_tkm": ("Weight (tonnes)", "Distance (km)"),
    "passenger_km": ("Distance per person, return (km)", "People"),
    "hotel": ("Nights", "Rooms"),
    "electricity": ("Energy (kWh)", "Multiplier"),
    "fuel": ("Litres", "Multiplier"),
    "waste": ("Tonnes", "Multiplier"),
    "spend": ("Spend (£)", "Multiplier"),
    "refrigerant": ("kg", "Multiplier"),
    "water": ("m³", "Multiplier"),
}

# Stand calculator sections
STAND_SECTIONS = {
    "materials": ("Materials & graphics", ["material", "spend"]),
    "logistics": ("Logistics & haulage", ["vehicle_km", "freight_tkm", "fuel"]),
    "travel": ("Crew travel & hotels", ["passenger_km", "vehicle_km", "hotel"]),
    "energy": ("On-site energy", ["electricity", "fuel"]),
    "waste": ("On-site waste", ["waste"]),
}

# Where stand sections land when rolled into the company footprint
STAND_TO_CATEGORY = {
    "materials": "s3_c1_purchased",
    "logistics": "s3_c4_upstream_transport",
    "travel": "s3_c6_business_travel",
    "energy": "s3_c1_purchased",
    "waste": "s3_c5_waste",
    "eol": "s3_c12_end_of_life",
}

EOL_ROUTES = {
    "reuse": ("Kept for reuse", None),
    "recycle": ("Recycled", "WST-MIXED-RECYCLE-T"),
    "efw": ("Energy from waste", "WST-MIXED-EFW-T"),
    "landfill": ("Landfill", "WST-MIXED-LANDFILL-T"),
}

ACTION_STATUSES = ["idea", "planned", "in_progress", "done"]
ROLES = ["admin", "editor", "viewer"]
