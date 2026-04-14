"""
Grids2Bricks – Flask API Server
Serves static files and exposes /api/create for BrickHeadz generation.
Firebase/Firestore + Firebase Storage entegrasyonu dahil.
"""
import os
import sys
import uuid
import shutil
import tempfile
import traceback
import threading

import fal_client
from flask import Flask, request, jsonify, send_from_directory

# Ensure the script directory is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# Import pipeline
import importlib.util
spec = importlib.util.spec_from_file_location(
    "pipeline", os.path.join(SCRIPT_DIR, "head_add_improved.py")
)
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)

# Import database layer
from db import (
    init_firebase,
    upload_file_to_storage
)
# Initialize Firebase on startup
init_firebase()

# One request at a time (CPU-heavy pipeline)
pipeline_lock = threading.Lock()

app = Flask(__name__, static_folder='.', static_url_path='')


# ---------- STATIC FILE ROUTES ----------

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    # /api ve /output route'larını buraya düşürme
    if filename.startswith('api/') or filename.startswith('output/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', filename)


# ---------- OUTPUT FILES ----------

@app.route('/output/<path:filename>')
def serve_output(filename):
    return send_from_directory(os.path.join(SCRIPT_DIR, 'output'), filename)


# ---------- API: CREATE ----------

@app.route('/api/create', methods=['POST'])
def create_brickheadz():
    # --- EKSİK OLAN KISIM BURASI (İstekten dosyayı alıyoruz) ---
    if 'photo' not in request.files:
        # Not: Frontend tarafında dosya inputunun name="photo" olduğunu varsayıyoruz.
        # Eğer name="file" ise buradaki 'photo' yazılarını 'file' yapmalısın.
        return jsonify({'error': 'No photo uploaded'}), 400
        
    photo_file = request.files['photo']
    
    if photo_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    # -------------------------------------------------------------

    # Formdan gelen diğer verileri al (varsa)
    person_number = int(request.form.get('person_number', 1))

    # Job ID'yi kendimiz üretiyoruz (veritabanı olmadığı için)
    job_id = str(uuid.uuid4())
    work_dir = tempfile.mkdtemp(prefix='g2b_')

    with pipeline_lock:
        try:
            # 1. Fotoğrafı yerel geçici klasöre kaydet
            ext = os.path.splitext(photo_file.filename)[1] or '.jpg'
            photo_path = os.path.join(work_dir, 'photo' + ext)
            photo_file.save(photo_path)

            # 2. Fal.ai'ye yükle ve URL'yi değişkene al
            fal_photo_url = fal_client.upload_file(photo_path)
            # 3. Pipeline global'larını sıfırla
            pipeline.arms_top   = None
            pipeline.skin_color = None
            pipeline.counter    = 0

            # 4. Gemini analizi
            person_data = pipeline.analyze_person(photo_path, person_number)

            # 5. fal.ai ile 4 view paralel üret
            view_paths = pipeline.generate_all_views_parallel(
                photo_path, person_data, skip_gen=False
            )


            ordered_labels = ['Front', 'Right', 'Back', 'Left']
            image_paths    = [view_paths.get(lbl) for lbl in ordered_labels]

            if not image_paths[0]:
                raise RuntimeError('Front view could not be generated')

            # 7. Kol tespiti
            pipeline.arms_top = pipeline.find_arm(image_paths[0])

            # 8. Grid analizi
            pipeline.counter    = 0
            pipeline.skin_color = None
            data_collection     = []

            for idx, path in enumerate(image_paths):
                label = ordered_labels[idx]
                if not path or not os.path.exists(path):
                    raise RuntimeError(f'{label} image not available')

                img, xc, yc, inv_bin = pipeline.grid_perspective(path)
                if img is None:
                    raise RuntimeError(f'{label} grid perspective failed')

                occ, col, c, r = pipeline.calculate_occupancy_matrices(
                    img, inv_bin, xc, yc
                )
                pipeline.counter += 1
                data_collection.append({
                    'occ': occ, 'col': col,
                    'skin_color': pipeline.skin_color
                })

            # 9. 3D space matrix
            final_matrix = pipeline.calculate_space_matrices(data_collection)

            # 10. LDR dosyasını yerel klasöre kaydet
            head_file = pipeline.HAIR_LDR_MAP.get(
                person_data.get('hair_type', 'default'),
                pipeline.HAIR_LDR_MAP['default']
            )
            output_name = f'brickheadz_{job_id[:8]}.ldr'
            output_path = os.path.join(work_dir, output_name) # work_dir'e kaydediyoruz ki sonra otomatik silinsin

            pipeline.save_merged_to_ldr(
                final_matrix,
                head_filename=head_file,
                output_filename=output_path,
                hair_data=person_data,
            )

            if not os.path.exists(output_path):
                raise RuntimeError('LDR file could not be created')

            # 11. LDR dosyasını Firebase Storage'a Yükle
            remote_ldr_name = f"jobs/{job_id}/{output_name}"
            ldr_public_url = upload_file_to_storage(output_path, remote_ldr_name)

            # 12. --- İŞTE YENİ KISIM: TXT DOSYASI OLUŞTURMA ---
            txt_name = f'info_{job_id[:8]}.txt'
            txt_path = os.path.join(work_dir, txt_name)
            
            # Tüm URL'leri txt içine yazıyoruz
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"Job ID: {job_id}\n")
                f.write(f"Durum: Tamamlandı\n")
                f.write(f"Orijinal Fotoğraf (Fal AI): {fal_photo_url}\n")
                f.write(f"LDR Dosyası (Firebase Storage): {ldr_public_url}\n")
                
                # Eğer view URL'lerin falan varsa onları da buraya f.write(...) ile ekleyebilirsin
                f.write(f"Ekstra Veri: {person_data}\n")

            # 13. TXT dosyasını da Firebase Storage'a yükle
            txt_name = f'info_{job_id[:8]}.txt'
            txt_path = os.path.join(work_dir, txt_name)
            
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"Job ID: {job_id}\n")
                f.write(f"Durum: Tamamlandı\n")
                f.write(f"Orijinal Fotoğraf (Fal AI): {fal_photo_url}\n")
                
                # Eğer kodunda view_urls değişkeni varsa, onları da txt'ye yazdıralım:
                if 'view_urls' in locals():
                    f.write("\n--- Uretilen Acilar ---\n")
                    for angle, url in view_urls.items():
                        f.write(f"{angle}: {url}\n")
                
                f.write(f"\nLDR Dosyası (Firebase Storage): {ldr_public_url}\n")
                f.write(f"Ekstra Veri: {person_data}\n")

            remote_txt_name = f"jobs/{job_id}/{txt_name}"
            txt_public_url = upload_file_to_storage(txt_path, remote_txt_name)
            # İşlem bitti, Frontend'e URL'leri dön
            return jsonify({
                'success':      True,
                'message':      'BrickHeadz model created successfully!',
                'job_id':       job_id,
                'ldr_url':      ldr_public_url,
                'info_txt_url': txt_public_url, # Yeni txt dosyamızın linki!
                'person_data':  person_data,
            })

        except Exception as e:
            traceback.print_exc()
            # Hata durumunda da istersen bir error.txt yükleyebilirsin Storage'a
            return jsonify({'error': str(e), 'job_id': job_id}), 500

        finally:
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
            except Exception:
                pass

@app.route('/api/instructions', methods=['GET'])
def get_instructions():
    """
    Parse an LDR file URL and return step-by-step build instructions as JSON.
    Query param: ?ldr_url=https://...
    """
    import urllib.request
    
    ldr_url = request.args.get('ldr_url')
    if not ldr_url:
        return jsonify({'error': 'ldr_url parameter required'}), 400
    
    try:
        with urllib.request.urlopen(ldr_url) as resp:
            ldr_text = resp.read().decode('utf-8')
    except Exception as e:
        return jsonify({'error': f'Could not fetch LDR: {e}'}), 400
    
    # Group bricks by Y layer (each Y = one build step)
    layers = {}
    for line in ldr_text.splitlines():
        parts = line.strip().split()
        if not parts or parts[0] != '1' or len(parts) < 15:
            continue
        color_id = parts[1]
        y_pos    = float(parts[3])
        part_file = parts[14].replace('.dat', '').replace('.ldr', '')
        
        layer_key = round(y_pos)  # group close Y values together
        if layer_key not in layers:
            layers[layer_key] = []
        layers[layer_key].append({
            'color': color_id,
            'part':  part_file,
            'x':     float(parts[2]),
            'y':     y_pos,
            'z':     float(parts[4]),
        })
    
    # Sort layers bottom-to-top (most positive Y first in LDraw = bottom)
    sorted_steps = []
    for y_key in sorted(layers.keys(), reverse=True):
        bricks = layers[y_key]
        # Count parts per color+type
        part_counts = {}
        for b in bricks:
            k = f"{b['color']}_{b['part']}"
            part_counts[k] = part_counts.get(k, 0) + 1
        
        sorted_steps.append({
            'step':        len(sorted_steps) + 1,
            'y_position':  y_key,
            'brick_count': len(bricks),
            'parts':       [{'key': k, 'count': c} for k, c in part_counts.items()],
            'bricks':      bricks,
        })
    
    return jsonify({
        'total_steps':  len(sorted_steps),
        'total_bricks': sum(len(layers[y]) for y in layers),
        'steps':        sorted_steps,
    })

@app.route('/api/download', methods=['GET'])
def proxy_download():
    import urllib.request
    from flask import Response
    url = request.args.get('url')
    if not url:
        return "No url provided", 400
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
        # "attachment" forces download instead of opening in browser
        return Response(
            content,
            mimetype="application/octet-stream",
            headers={"Content-disposition": "attachment; filename=brickheadz.ldr"}
        )
    except Exception as e:
        return str(e), 400
        
@app.route('/api/proxy', methods=['GET'])
def proxy_file():
    import urllib.request
    from flask import Response
    url = request.args.get('url')
    if not url:
        return "No url provided", 400
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
        return Response(
            content,
            mimetype="text/plain"
        )
    except Exception as e:
        return str(e), 400

# ---------- API: JOB STATUS ----------

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Belirli bir job'ın durumunu döner."""
    job = get_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)


# ---------- API: JOB LIST (admin) ----------

@app.route('/api/jobs', methods=['GET'])
def list_all_jobs():
    """
    Son 50 job'ı listeler.
    Güvenlik notu: production'da bu endpoint'i auth ile koru.
    """
    limit = int(request.args.get('limit', 50))
    jobs  = list_jobs(limit=limit)
    return jsonify({'jobs': jobs, 'count': len(jobs)})


if __name__ == '__main__':
    print("=" * 50)
    print("  Grids2Bricks Server")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)
