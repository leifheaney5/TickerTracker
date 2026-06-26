from flask import Flask, jsonify

app = Flask(__name__)


def envelope(data, source="internal", stale=False):
    return jsonify({"data": data, "meta": {"source": source, "stale": stale}})


@app.route("/api/health")
def health():
    return envelope({"status": "ok"})


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
