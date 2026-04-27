"""
Grids2Bricks – Flask API Server
Serves static files and exposes /api/create for BrickHeadz generation.
Firebase Storage integration included.
"""
import os
import sys
import uuid
import shutil
import tempfile
import traceback
import threading
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory, Response

# ── Path setup ──────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# ── Pipeline import (lazy – only load when actually needed) ─────────────────
_pipeline = None
_pipeline_lock = threading.Lock()

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "pipeline", os.path.join(SCRIPT_DIR, "head_add_improved.py")
        )
        _pipeline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_pipeline)
    return _pipeline

# ── Firebase (optional – skip gracefully if credentials missing) ─────────────
_firebase_ready = False
def _try_init_firebase():
    global _firebase_ready
    try:
        from db import init_firebase
        init_firebase()
        _firebase_ready = True
        print("[Firebase] Initialized OK")
    except FileNotFoundError as e:
        print(f"[Firebase] WARNING: {e}  -- Firebase disabled, LDR files won't be stored.")
    except Exception as e:
        print(f"[Firebase] WARNING: {e}  — Firebase disabled.")

_try_init_firebase()

# ── Flask app ────────────────────────────────────────────────────────────────
# Since server.py is INSIDE the public folder now, static files are in the same dir.
DIST_DIR = SCRIPT_DIR

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")

# One request at a time for the CPU-heavy pipeline
pipeline_lock = threading.Lock()


# ────────────────────────────────────────────────────────────────────────────
# STATIC FILE SERVING  (SPA fallback)
# ────────────────────────────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    # Never intercept API calls here
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    static_root = app.static_folder
    if not static_root or not os.path.isdir(static_root):
        return ("<h1>Static directory missing</h1><p>The frontend files could not be found.</p>", 503)

    # 1. Try serving the file exactly as requested (e.g., /assets/style.css)
    full_path = os.path.join(static_root, path)
    if path and os.path.isfile(full_path):
        return send_from_directory(static_root, path)

    # 2. Support clean URLs (e.g., /create -> create.html)
    if path and not path.endswith(".html"):
        html_path = path + ".html"
        if os.path.isfile(os.path.join(static_root, html_path)):
            return send_from_directory(static_root, html_path)

    # 3. Default to index.html
    return send_from_directory(static_root, "index.html")


# ────────────────────────────────────────────────────────────────────────────
# API: COUNTER
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/counter", methods=["GET"])
def get_model_counter():
    count = 0 # Baseline number
    if _firebase_ready:
        try:
            from db import get_counter, get_reviews, add_review
            count += get_counter()
        except Exception as e:
            print(f"[Counter] Error fetching: {e}")
    return jsonify({"count": count})


# ────────────────────────────────────────────────────────────────────────────
# API: CREATE
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/create", methods=["POST"])
def create_brickheadz():
    import fal_client

    if "photo" not in request.files:
        return jsonify({"error": "No photo uploaded (field name must be 'photo')"}), 400

    photo_file = request.files["photo"]
    if photo_file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    person_number = int(request.form.get("person_number", 1))
    job_id   = str(uuid.uuid4())
    work_dir = tempfile.mkdtemp(prefix="g2b_")

    with pipeline_lock:
        try:
            pl = get_pipeline()

            # 1. Save photo locally
            ext = os.path.splitext(photo_file.filename)[1] or ".jpg"
            photo_path = os.path.join(work_dir, "photo" + ext)
            photo_file.save(photo_path)

            # 2. Upload to fal.ai
            fal_photo_url = fal_client.upload_file(photo_path)

            # 3. Reset pipeline globals
            pl.arms_top   = None
            pl.skin_color = None
            pl.counter    = 0

            # 4. Gemini analysis
            person_data = pl.analyze_person(photo_path, person_number)

            # 5. Generate 4 views in parallel
            view_paths = pl.generate_all_views_parallel(
                photo_path, person_data, skip_gen=False
            )

            ordered_labels = ["Front", "Right", "Back", "Left"]
            image_paths    = [view_paths.get(lbl) for lbl in ordered_labels]

            if not image_paths[0]:
                raise RuntimeError("Front view could not be generated")

            # 6. Arm detection
            pl.arms_top = pl.find_arm(image_paths[0])

            # 7. Grid analysis
            pl.counter    = 0
            pl.skin_color = None
            data_collection = []

            for idx, path in enumerate(image_paths):
                label = ordered_labels[idx]
                if not path or not os.path.exists(path):
                    raise RuntimeError(f"{label} image not available")

                img, xc, yc, inv_bin = pl.grid_perspective(path)
                if img is None:
                    raise RuntimeError(f"{label} grid perspective failed")

                occ, col, c, r = pl.calculate_occupancy_matrices(img, inv_bin, xc, yc)
                pl.counter += 1
                data_collection.append({"occ": occ, "col": col, "skin_color": pl.skin_color})

            # 8. 3D space matrix
            final_matrix = pl.calculate_space_matrices(data_collection)

            # 9. Save LDR
            head_file = pl.HAIR_LDR_MAP.get(
                person_data.get("hair_type", "default"),
                pl.HAIR_LDR_MAP["default"],
            )
            now_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            output_name = f"brickheadz_{now_str}_{job_id[:8]}.ldr"
            output_path = os.path.join(work_dir, output_name)

            pl.save_merged_to_ldr(
                final_matrix,
                head_filename=head_file,
                output_filename=output_path,
                hair_data=person_data,
            )

            if not os.path.exists(output_path):
                raise RuntimeError("LDR file could not be created")

            # 10. Upload to Firebase Storage (if available)
            ldr_url      = None
            download_url = None

            if _firebase_ready:
                try:
                    from db import upload_blob_to_storage, increment_counter
                    # Use timestamp as folder name so files are easy to find by date
                    remote_ldr_path = f"jobs/{now_str}/{output_name}"
                    upload_blob_to_storage(output_path, remote_ldr_path)
                    ldr_url      = f"/api/ldr/{remote_ldr_path}"
                    download_url = f"/api/download/{remote_ldr_path}"
                    # Increment counter in Firestore
                    increment_counter()
                except Exception as fb_err:
                    print(f"[Firebase] Upload warning: {fb_err}")

            # 11. Fallback: serve LDR from memory via a signed temp URL
            #     (works even without Firebase)
            if not ldr_url:
                with open(output_path, "rb") as f:
                    ldr_bytes = f.read()
                # Store in a simple in-memory dict (fine for single-instance Render free plan)
                _ldr_cache[job_id] = ldr_bytes
                ldr_url      = f"/api/ldr-cache/{job_id}/{output_name}"
                download_url = f"/api/download-cache/{job_id}/{output_name}"

            return jsonify({
                "success":     True,
                "message":     "BrickHeadz model created successfully!",
                "job_id":      job_id,
                "ldr_url":     ldr_url,
                "download_url": download_url,
                "person_data": person_data,
            })

        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": str(e), "job_id": job_id}), 500

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


# ── In-memory LDR cache (fallback when Firebase is unavailable) ──────────────
_ldr_cache: dict[str, bytes] = {}


@app.route("/api/ldr-cache/<job_id>/<filename>")
def serve_ldr_cache(job_id, filename):
    data = _ldr_cache.get(job_id)
    if not data:
        return jsonify({"error": "LDR not found (may have expired)"}), 404
    return Response(data, mimetype="text/plain",
                    headers={"Access-Control-Allow-Origin": "*"})


@app.route("/api/download-cache/<job_id>/<filename>")
def download_ldr_cache(job_id, filename):
    data = _ldr_cache.get(job_id)
    if not data:
        return jsonify({"error": "LDR not found (may have expired)"}), 404
    return Response(data, mimetype="application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ────────────────────────────────────────────────────────────────────────────
# API: REVIEWS
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/reviews", methods=["GET"])
def get_community_reviews():
    """Fetch recent reviews for the community wall."""
    from db import get_reviews
    limit = request.args.get("limit", default=10, type=int)
    data = get_reviews(limit=limit)
    return jsonify(data)


@app.route("/api/reviews", methods=["POST"])
def post_review():
    """Submit a new user review."""
    from db import add_review
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400

    user_name = data.get("user_name", "Anonymous")
    rating    = data.get("rating", 5)
    comment   = data.get("comment", "")
    job_id    = data.get("job_id")

    success = add_review(user_name, rating, comment, job_id)
    return jsonify({"success": success})


# ────────────────────────────────────────────────────────────────────────────
# FIREBASE PROXY ROUTES
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/download/<path:blob_path>")
def download_ldr(blob_path):
    if not _firebase_ready:
        return jsonify({"error": "Firebase not configured"}), 503
    from firebase_admin import storage as fb_storage
    try:
        bucket   = fb_storage.bucket()
        blob     = bucket.blob(blob_path)
        data     = blob.download_as_bytes()
        filename = blob_path.split("/")[-1]
        return Response(
            data,
            mimetype="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route("/api/ldr/<path:blob_path>")
def serve_ldr_text(blob_path):
    if not _firebase_ready:
        return jsonify({"error": "Firebase not configured"}), 503
    from firebase_admin import storage as fb_storage
    try:
        bucket = fb_storage.bucket()
        blob   = bucket.blob(blob_path)
        data   = blob.download_as_bytes()
        return Response(
            data,
            mimetype="text/plain",
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 404


# ────────────────────────────────────────────────────────────────────────────
# GENERIC PROXY (used by frontend for cross-origin LDR files)
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/proxy")
def proxy_file():
    import urllib.request
    url = request.args.get("url")
    if not url:
        return "No url provided", 400
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
        return Response(content, mimetype="text/plain")
    except Exception as e:
        return str(e), 400


@app.route("/api/download")
def proxy_download():
    import urllib.request
    url = request.args.get("url")
    if not url:
        return "No url provided", 400
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
        return Response(
            content,
            mimetype="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=brickheadz.ldr"},
        )
    except Exception as e:
        return str(e), 400


# ────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ────────────────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({
        "status":         "ok",
        "firebase":       _firebase_ready,
        "frontend_built": os.path.isdir(DIST_DIR),
    })


# ────────────────────────────────────────────────────────────────────────────
# DEV ENTRY POINT
# ────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  Grids2Bricks Server  ->  http://localhost:5000")
    print(f"  Firebase: {'enabled' if _firebase_ready else 'DISABLED (no credentials)'}")
    print(f"  Frontend: {'built OK' if os.path.isdir(DIST_DIR) else 'NOT built -- run build.sh'}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)