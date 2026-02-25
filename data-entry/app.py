from flask import Flask, request, jsonify, render_template_string, redirect, url_for
import pandas as pd

app = Flask(__name__)

# Load stoppages from Excel
stoppages = pd.read_excel("allstop.xlsx")

# Initialize distance table
distance_cols = ["Stop Order", "Stop ID", "Distance", "Route ID"]
try:
    distance = pd.read_excel("distance.xlsx")
except FileNotFoundError:
    distance = pd.DataFrame(columns=distance_cols)


@app.route("/")
def index():
    return render_template_string(TEMPLATE, table=distance.to_dict(orient="records"))


@app.route("/suggest")
def suggest():
    query = request.args.get("q", "").lower()
    matches = stoppages[stoppages["Stopage En"].str.lower().str.contains(query) |
                        stoppages["Stopage Bn"].str.contains(query)]
    return jsonify(matches.to_dict(orient="records"))


@app.route("/add", methods=["POST"])
def add_stopage():
    stop_id = int(request.form["stop_id"])
    distance_val = float(request.form["distance"])
    route_id = request.form["route_id"]

    # Determine stop order for this route
    global distance
    if distance[distance["Route ID"] == route_id].empty:
        stop_order = 1
    else:
        stop_order = distance[distance["Route ID"] == route_id]["Stop Order"].max() + 1

    new_row = {
        "Stop Order": stop_order,
        "Stop ID": stop_id,
        "Distance": distance_val,
        "Route ID": route_id
    }

    distance = pd.concat([distance, pd.DataFrame([new_row])], ignore_index=True)
    distance.to_excel("distance.xlsx", index=False)

    return redirect(url_for("index"))


TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Distance Table Manager</title>
    <script>
        async function fetchSuggestions() {
            let query = document.getElementById("stop_name").value;
            if (query.length < 1) {
                document.getElementById("suggestions").innerHTML = "";
                return;
            }
            let response = await fetch(`/suggest?q=${query}`);
            let data = await response.json();
            let list = data.map(row => 
                `<div onclick="chooseStop(${row['Stopage ID']}, '${row['Stopage En']}')">
                    ${row['Stopage ID']} - ${row['Stopage En']} (${row['Stopage Bn']})
                </div>`
            ).join("");
            document.getElementById("suggestions").innerHTML = list;
        }

        function chooseStop(id, name) {
            document.getElementById("stop_id").value = id;
            document.getElementById("stop_name").value = name;
            document.getElementById("suggestions").innerHTML = "";
        }

        // Save Route ID in localStorage whenever changed
        document.addEventListener("DOMContentLoaded", function() {
            let routeInput = document.getElementById("route_id");

            // Restore saved Route ID
            let savedRoute = localStorage.getItem("route_id");
            if (savedRoute) {
                routeInput.value = savedRoute;
            }

            // Save when user types
            routeInput.addEventListener("input", function() {
                localStorage.setItem("route_id", this.value);
            });
        });

        // Clear Route ID manually
        function clearRoute() {
            localStorage.removeItem("route_id");
            document.getElementById("route_id").value = "";
        }
    </script>
</head>
<body>
    <h2>Add Stopage to Distance Table</h2>
    <form method="POST" action="/add">
        Route ID: <input type="text" id="route_id" name="route_id" required>
        <button type="button" onclick="clearRoute()">Clear Route</button><br><br>

        Stop Name: <input type="text" id="stop_name" onkeyup="fetchSuggestions()" autocomplete="off" required><br>
        <div id="suggestions" style="border:1px solid #ccc; max-width:300px;"></div>
        Stop ID: <input type="text" id="stop_id" name="stop_id" readonly required><br>
        Distance: <input type="text" name="distance" required><br>
        <button type="submit">Add Stop</button>
    </form>

    <h3>Current Distance Table</h3>
    <table border="1">
        <tr>
            <th>Stop Order</th><th>Stop ID</th><th>Distance</th><th>Route ID</th>
        </tr>
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
    app.run(debug=True)
