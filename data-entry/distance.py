from flask import Flask, request, jsonify, render_template_string, redirect, url_for
import pandas as pd
from datetime import datetime, time

app = Flask(__name__)

# --- Load stoppages (try Excel, else fallback sample) ---
try:
    stoppages = pd.read_excel("allstop.xlsx")
except Exception:
    # Minimal fallback so app still runs if user doesn't have the Excel file.
    stoppages = pd.DataFrame([
        {"Stopage ID": 1, "Stopage En": "Gabtoli", "Stopage Bn": "গাবতলী"},
        {"Stopage ID": 2, "Stopage En": "Mohakhali", "Stopage Bn": "মোহাম্মদী"},
        {"Stopage ID": 3, "Stopage En": "Farmgate", "Stopage Bn": "ফার্মগেট"},
        {"Stopage ID": 4, "Stopage En": "Dhanmondi", "Stopage Bn": "ধানমন্ডি"},
        {"Stopage ID": 5, "Stopage En": "Mirpur", "Stopage Bn": "মিরপুর"},
    ])

# --- Load or initialize distance table ---
distance_cols = ["Stop Order", "Stop ID", "Distance", "Route ID"]
try:
    distance = pd.read_excel("distance.xlsx")
except FileNotFoundError:
    distance = pd.DataFrame(columns=distance_cols)

# --- Fare rules (approximate, customizable) ---
# We'll support vehicle types: 'bus', 'micro', 'cng', 'tempo', 'ride_share'
FARE_RULES = {
    "bus": {
        "base_km": 3,       # first 3 km fixed base fare
        "base_fare": 15.0,  # base fare in BDT
        "per_km": 4.0       # per km after base_km
    },
    "micro": {
        "base_km": 2,
        "base_fare": 20.0,
        "per_km": 6.0
    },
    "cng": {
        "base_km": 1,
        "base_fare": 25.0,
        "per_km": 12.0
    },
    "tempo": {
        "base_km": 2,
        "base_fare": 18.0,
        "per_km": 8.0
    },
    "ride_share": {
        "base_km": 2,
        "base_fare": 40.0,
        "per_km": 18.0,
        "min_fare": 40.0
    }
}

# Peak hour multiplier (morning & evening)
PEAK_HOURS = [ (time(7,0), time(9,30)), (time(17,0), time(20,0)) ]
PEAK_MULTIPLIER = 1.25

# Student concession (percentage)
CONCESSION = {
    "student": 0.30,   # 30% off if student selected
    "senior": 0.20     # 20% off for seniors
}

# --- Helper functions ---
def is_peak(now=None):
    if now is None:
        now = datetime.now().time()
    for start, end in PEAK_HOURS:
        if start <= now <= end:
            return True
    return False

def calculate_distance_between(stops_df, from_id, to_id):
    """
    Attempt to calculate linear route distance by summing 'Distance' in distance table
    for the chosen route. If route info not available, return None to fallback to euclidean-like guess.
    """
    # If distance table has entries for same Route ID across stops, we could try to sum
    # But since we don't know the route ID selection here, compute a simple absolute difference
    # of cumulative distances for each Stop ID if available.
    try:
        # create cumulative distance by stop id (group by stop id - uses last seen)
        if distance.empty:
            return None
        # Build mapping of Stop ID -> cumulative distance along each route (we'll take mean if multiple routes)
        map_dist = distance.groupby("Stop ID")["Distance"].mean().to_dict()
        if from_id in map_dist and to_id in map_dist:
            return abs(map_dist[to_id] - map_dist[from_id])
        else:
            return None
    except Exception:
        return None

def estimate_distance_fallback(from_id, to_id):
    """
    When no distance table is present, estimate distance simply by absolute difference in stop IDs * a factor.
    This is a very rough fallback and should be replaced with real distances.
    """
    try:
        return abs(int(to_id) - int(from_id)) * 2.0  # assume ~2 km between sequential numeric stops
    except Exception:
        return 5.0

def compute_fare_for(distance_km, vehicle_type, is_peak_flag=False, concession_type=None):
    rules = FARE_RULES.get(vehicle_type, FARE_RULES["micro"])
    base_km = rules["base_km"]
    base_fare = rules["base_fare"]
    per_km = rules["per_km"]
    fare = base_fare
    if distance_km > base_km:
        fare += (distance_km - base_km) * per_km
    if "min_fare" in rules:
        fare = max(fare, rules["min_fare"])
    if is_peak_flag:
        fare *= PEAK_MULTIPLIER
    if concession_type in CONCESSION:
        fare *= (1 - CONCESSION[concession_type])
    return round(fare, 2)

# --- Routes ---
@app.route("/")
def index():
    # Show main form and current distance table
    return render_template_string(MAIN_TEMPLATE, table=distance.to_dict(orient="records"))

@app.route("/suggest")
def suggest():
    query = request.args.get("q", "").lower()
    if not query:
        return jsonify([])
    matches = stoppages[
        stoppages["Stopage En"].str.lower().str.contains(query) |
        stoppages["Stopage Bn"].str.contains(query) |
        stoppages["Stopage ID"].astype(str).str.contains(query)
    ]
    # Limit to top 10
    return jsonify(matches.head(10).to_dict(orient="records"))

@app.route("/add", methods=["POST"])
def add_stopage():
    stop_id = int(request.form["stop_id"])
    distance_val = float(request.form["distance"])
    route_id = request.form["route_id"] or "default"

    global distance
    # Determine stop order for this route
    if distance[distance["Route ID"] == route_id].empty:
        stop_order = 1
    else:
        stop_order = int(distance[distance["Route ID"] == route_id]["Stop Order"].max()) + 1

    new_row = {
        "Stop Order": stop_order,
        "Stop ID": stop_id,
        "Distance": distance_val,
        "Route ID": route_id
    }

    distance = pd.concat([distance, pd.DataFrame([new_row])], ignore_index=True)
    try:
        distance.to_excel("distance.xlsx", index=False)
    except Exception:
        pass  # ignore file write errors for now

    return redirect(url_for("index"))

@app.route("/calculate", methods=["POST"])
def calculate():
    try:
        from_id = int(request.form["from_id"])
        to_id = int(request.form["to_id"])
    except Exception:
        return render_template_string(MAIN_TEMPLATE, table=distance.to_dict(orient="records"),
                                      error="Invalid stop IDs. Please choose from suggestions.")

    vehicle = request.form.get("vehicle", "micro")
    concession = request.form.get("concession", "none")

    # Determine distance
    dist = calculate_distance_between(stoppages, from_id, to_id)
    if dist is None:
        dist = estimate_distance_fallback(from_id, to_id)

    peak_flag = is_peak()

    fare = compute_fare_for(dist, vehicle, is_peak_flag=peak_flag, concession_type=(concession if concession != "none" else None))

    result = {
        "from_id": from_id,
        "to_id": to_id,
        "distance_km": round(dist, 2),
        "vehicle": vehicle,
        "peak": peak_flag,
        "concession": concession,
        "fare": fare
    }

    return render_template_string(MAIN_TEMPLATE, table=distance.to_dict(orient="records"), result=result)

# --- Simple API to compute fare without HTML (for programmatic use) ---
@app.route("/api/fare", methods=["GET"])
def api_fare():
    # Parameters: from_id, to_id, vehicle, concession
    try:
        from_id = int(request.args.get("from_id"))
        to_id = int(request.args.get("to_id"))
    except Exception:
        return jsonify({"error": "from_id and to_id required and must be integers"}), 400
    vehicle = request.args.get("vehicle", "micro")
    concession = request.args.get("concession", "none")

    dist = calculate_distance_between(stoppages, from_id, to_id)
    if dist is None:
        dist = estimate_distance_fallback(from_id, to_id)
    peak_flag = is_peak()
    fare = compute_fare_for(dist, vehicle, is_peak_flag=peak_flag, concession_type=(concession if concession != "none" else None))

    return jsonify({
        "from_id": from_id,
        "to_id": to_id,
        "distance_km": round(dist, 2),
        "vehicle": vehicle,
        "peak": peak_flag,
        "concession": concession,
        "fare": fare
    })


# --- Frontend template (single-file) ---
MAIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Dhaka Fare Calculator</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 20px auto; }
        .container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
        input[type=text], select { width: 100%; padding: 6px; margin: 6px 0; box-sizing: border-box; }
        button { padding: 8px 12px; margin-top: 8px; }
        #suggestions div { padding:6px; cursor:pointer; }
        #suggestions div:hover { background:#f0f0f0; }
        table { width:100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding:6px; border:1px solid #ccc; text-align:left; }
        .result { font-weight: bold; margin-top: 10px; }
    </style>
    <script>
        async function fetchSuggestions(elId) {
            let q = document.getElementById(elId).value;
            if (!q || q.length < 1) {
                document.getElementById(elId + "_suggestions").innerHTML = "";
                return;
            }
            let res = await fetch(`/suggest?q=${encodeURIComponent(q)}`);
            let data = await res.json();
            let html = data.map(row =>
                `<div onclick="chooseStop('${elId}', ${row['Stopage ID']}, ${JSON.stringify(row['Stopage En'])})">
                    ${row['Stopage ID']} - ${row['Stopage En']} (${row['Stopage Bn']})
                </div>`
            ).join("");
            document.getElementById(elId + "_suggestions").innerHTML = html;
        }

        function chooseStop(elId, id, name) {
            if (elId === "from") {
                document.getElementById("from_id").value = id;
                document.getElementById("from").value = name;
            } else {
                document.getElementById("to_id").value = id;
                document.getElementById("to").value = name;
            }
            document.getElementById(elId + "_suggestions").innerHTML = "";
        }

        // Restore saved Route ID for adding stops
        document.addEventListener("DOMContentLoaded", function() {
            let routeInput = document.getElementById("route_id");
            if (!routeInput) return;
            let saved = localStorage.getItem("route_id");
            if (saved) routeInput.value = saved;
            routeInput.addEventListener("input", function() {
                localStorage.setItem("route_id", this.value);
            });
        });

        function clearRoute() {
            localStorage.removeItem("route_id");
            let el = document.getElementById("route_id");
            if (el) el.value = "";
        }
    </script>
</head>
<body>
    <h2>Dhaka Fare Calculator</h2>
    {% if error %}
        <div style="color:red;">{{ error }}</div>
    {% endif %}
    <div class="container">
        <div class="box">
            <h3>Calculate Fare</h3>
            <form method="POST" action="/calculate">
                From: <input type="text" id="from" onkeyup="fetchSuggestions('from')" placeholder="Type stop name or id" required>
                <div id="from_suggestions" style="border:1px solid #ddd; max-height:160px; overflow:auto;"></div>
                <input type="hidden" id="from_id" name="from_id">

                To: <input type="text" id="to" onkeyup="fetchSuggestions('to')" placeholder="Type stop name or id" required>
                <div id="to_suggestions" style="border:1px solid #ddd; max-height:160px; overflow:auto;"></div>
                <input type="hidden" id="to_id" name="to_id">

                Vehicle:
                <select name="vehicle">
                    <option value="bus">Bus</option>
                    <option value="micro" selected>Microbus / Minibus</option>
                    <option value="cng">CNG / Auto</option>
                    <option value="tempo">Tempo</option>
                    <option value="ride_share">Ride-share</option>
                </select>

                Concession:
                <select name="concession">
                    <option value="none">None</option>
                    <option value="student">Student (30% off)</option>
                    <option value="senior">Senior (20% off)</option>
                </select>

                <button type="submit">Calculate Fare</button>
            </form>

            {% if result %}
                <div class="result">
                    From ID: {{ result.from_id }} &nbsp; To ID: {{ result.to_id }} <br>
                    Distance: {{ result.distance_km }} km <br>
                    Vehicle: {{ result.vehicle }} {% if result.peak %}(Peak){% endif %} <br>
                    Concession: {{ result.concession }} <br>
                    <div style="font-size:1.2em; margin-top:6px;">Estimated Fare: BDT {{ result.fare }}</div>
                </div>
            {% endif %}
        </div>

        <div class="box">
            <h3>Add Stopage to Distance Table</h3>
            <form method="POST" action="/add">
                Route ID: <input type="text" id="route_id" name="route_id" required>
                <button type="button" onclick="clearRoute()">Clear Route</button><br><br>

                Stop Name: <input type="text" id="stop_name" onkeyup="fetchSuggestions('stop_name')" autocomplete="off" required><br>
                <div id="stop_name_suggestions" style="border:1px solid #ccc; max-width:300px;"></div>

                Stop ID: <input type="text" id="stop_id" name="stop_id" readonly required><br>
                Distance (cumulative km from route start): <input type="text" name="distance" required><br>
                <button type="submit">Add Stop</button>
            </form>

            <script>
                // reuse chooseStop for adding stops using a small helper wrapper
                function fetchSuggestionsForAdd() {
                    let query = document.getElementById("stop_name").value;
                    if (!query || query.length < 1) {
                        document.getElementById("stop_name_suggestions").innerHTML = "";
                        return;
                    }
                    fetch(`/suggest?q=${encodeURIComponent(query)}`).then(r => r.json()).then(data => {
                        let list = data.map(row =>
                            `<div onclick="chooseStopForAdd(${row['Stopage ID']}, '${row['Stopage En']}')">
                                ${row['Stopage ID']} - ${row['Stopage En']} (${row['Stopage Bn']})
                            </div>`
                        ).join("");
                        document.getElementById("stop_name_suggestions").innerHTML = list;
                    });
                }

                function chooseStopForAdd(id, name) {
                    document.getElementById("stop_id").value = id;
                    document.getElementById("stop_name").value = name;
                    document.getElementById("stop_name_suggestions").innerHTML = "";
                }

                document.getElementById("stop_name")?.addEventListener("keyup", fetchSuggestionsForAdd);
            </script>
        </div>
    </div>

    <h3>Current Distance Table</h3>
    <table>
        <tr><th>Stop Order</th><th>Stop ID</th><th>Distance</th><th>Route ID</th></tr>
        {% for row in table %}
            <tr>
                <td>{{ row['Stop Order'] }}</td>
                <td>{{ row['Stop ID'] }}</td>
                <td>{{ row['Distance'] }}</td>
                <td>{{ row['Route ID'] }}</td>
            </tr>
        {% endfor %}
    </table>
</body>
</html>
"""

if __name__ == "__main__":
    # Run on localhost:5000 in debug for development. In production, disable debug and use a WSGI server.
    app.run(debug=True)
