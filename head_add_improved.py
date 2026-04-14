from email.mime import base
import os
import json
import argparse
import time
import concurrent.futures
from datetime import datetime
import cv2
import numpy as np
from matplotlib import pyplot as plt
import requests
import fal_client      # pip install fal-client

# =============================================================================
# --- CONFIGURATION ---
# =============================================================================

os.environ["FAL_KEY"] = "92d3be43-e782-48a7-86d7-e7fbc5be29c9:e81ebb1823d07d90eb81b0faadafaef8"

# Template images (plain grey default BrickHeadz, one per view) – Top view removed
TEMPLATE_PATHS = {
    "Front": r"picture examples/DefaultGrayGuy_FrontView.PNG",
    "Right": r"picture examples/DefaultGrayGuy_RightView.PNG",
    "Back":  r"picture examples/DefaultGrayGuy_BackView.PNG",
    "Left":  r"picture examples/DefaultGrayGuy_LeftView.PNG",
}

# Where generated images are saved locally (so we can reuse them with --skip-gen)
GENERATED_DIR = "generated_views"
os.makedirs(GENERATED_DIR, exist_ok=True)

# Mapping: hair_type (string from Claude) → LDR snippet file
# Add/adjust snippet files to match your library.
HAIR_LDR_MAP = {
    "short_straight":  "hair_snippets/short_straight.ldr",
    "short_curly":     "hair_snippets/short_curly.ldr",
    "long_straight":   "hair_snippets/long_straight.ldr",
    "long_curly":      "hair_snippets/long_curly.ldr",
    "wavy":            "hair_snippets/wavy.ldr",
    "bald":            "hair_snippets/bald.ldr",
    "afro":            "hair_snippets/afro.ldr",
    "default":         "hair_snippets/default.ldr",  # fallback
}

# =============================================================================
# --- 1. COLOR DEFINITIONS ---
# =============================================================================

LDRAW_COLORS = {
    0:   {"name": "Black",               "rgb": (27,  42,  52)},
    1:   {"name": "Blue",                "rgb": (0,   85,  191)},
    2:   {"name": "Green",               "rgb": (0,   133, 43)},
    3:   {"name": "Dark Turquoise",      "rgb": (0,   143, 155)},
    4:   {"name": "Red",                 "rgb": (196, 0,   38)},
    5:   {"name": "Dark Pink",           "rgb": (223, 102, 149)},
    6:   {"name": "Brown",               "rgb": (88,  57,  39)},
    7:   {"name": "Light Gray",          "rgb": (156, 156, 156)},
    8:   {"name": "Dark Gray",           "rgb": (99,  95,  82)},
    9:   {"name": "Light Blue",          "rgb": (180, 210, 227)},
    10:  {"name": "Bright Green",        "rgb": (88,  171, 65)},
    11:  {"name": "Light Turquoise",     "rgb": (0,   167, 186)},
    12:  {"name": "Salmon",              "rgb": (242, 112, 94)},
    13:  {"name": "Pink",                "rgb": (252, 151, 172)},
    14:  {"name": "Yellow",              "rgb": (242, 205, 55)},
    15:  {"name": "White",               "rgb": (255, 255, 255)},
    17:  {"name": "Light Green",         "rgb": (194, 218, 184)},
    19:  {"name": "Tan",                 "rgb": (228, 205, 158)},
    22:  {"name": "Purple",              "rgb": (129, 0,   123)},
    25:  {"name": "Orange",              "rgb": (254, 138, 24)},
    26:  {"name": "Magenta",             "rgb": (146, 57,  120)},
    27:  {"name": "Lime",                "rgb": (187, 233, 11)},
    28:  {"name": "Dark Tan",            "rgb": (135, 114, 73)},
    29:  {"name": "Bright Pink",         "rgb": (228, 173, 200)},
    70:  {"name": "Reddish Brown",       "rgb": (105, 64,  39)},
    71:  {"name": "Light Bluish Gray",   "rgb": (160, 165, 169)},
    72:  {"name": "Dark Bluish Gray",    "rgb": (108, 110, 104)},
    78:  {"name": "Light Nougat",        "rgb": (246, 215, 179)},
    84:  {"name": "Medium Nougat",       "rgb": (170, 125, 85)},
    85:  {"name": "Dark Purple",         "rgb": (50,  29,  93)},
    89:  {"name": "Royal Blue",          "rgb": (75,  99,  157)},
    92:  {"name": "Flesh",               "rgb": (215, 169, 124)},
    191: {"name": "Bright Light Orange", "rgb": (252, 172, 0)},
    212: {"name": "Bright Light Blue",   "rgb": (159, 195, 233)},
    226: {"name": "Bright Light Yellow", "rgb": (255, 236, 108)},
    272: {"name": "Dark Blue",           "rgb": (0,   32,  160)},
    288: {"name": "Dark Green",          "rgb": (0,   69,  26)},
    308: {"name": "Dark Brown",          "rgb": (53,  33,  0)},
    320: {"name": "Dark Red",            "rgb": (114, 14,  15)},
    321: {"name": "Dark Azure",          "rgb": (70,  155, 195)},
    322: {"name": "Medium Azure",        "rgb": (104, 195, 226)},
    323: {"name": "Light Aqua",          "rgb": (173, 208, 199)},
    326: {"name": "Olive Green",         "rgb": (185, 180, 68)},
    330: {"name": "Sand Green",          "rgb": (160, 188, 172)},
    335: {"name": "Sand Red",            "rgb": (190, 130, 115)},
    351: {"name": "Medium Dark Pink",    "rgb": (255, 101, 156)},
    353: {"name": "Coral",               "rgb": (255, 109, 119)},
    462: {"name": "Medium Orange",       "rgb": (255, 160, 40)},
    484: {"name": "Dark Orange",         "rgb": (169, 85,  0)},
}


def _rgb_distance(c1, c2):
    return np.sqrt(sum((int(a) - int(b)) ** 2 for a, b in zip(c1, c2)))


def get_dominant_color(roi_bgr):
    if roi_bgr.size == 0:
        return 15
    hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    saturation_mask = s > 40
    valid_pixels = np.count_nonzero(saturation_mask)
    total = roi_bgr.shape[0] * roi_bgr.shape[1]
    if valid_pixels < (total * 0.15):
        mean_val = np.mean(v)
        if mean_val < 60:   return 0
        if mean_val < 130:  return 72
        if mean_val < 200:  return 71
        return 15
    mean_bgr = cv2.mean(roi_bgr)[:3]
    mean_rgb  = (int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))
    best_code = 4
    best_dist = float("inf")
    for code, info in LDRAW_COLORS.items():
        dist = _rgb_distance(mean_rgb, info["rgb"])
        if dist < best_dist:
            best_dist = dist
            best_code = code
    return best_code


# =============================================================================
# --- 2. IMAGE GENERATION VIA FAL.AI ---
# =============================================================================

def _generate_single_view_task(task_data: tuple) -> tuple:
    """
    Worker function executed in a thread pool.
    Generates ONE view image via fal.ai and downloads it locally.

    task_data : (view_label, ref_photo_path, template_path, person_data)
    Returns   : (view_label, local_file_path_or_None)
    """
    view_label, ref_photo_path, template_path, person_data = task_data

    output_path = os.path.join(GENERATED_DIR, f"generated_{view_label}.png")
    start_t = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"🚀 [FAL-PARALLEL] {view_label} başlatıldı ({start_t})")

    # Build a detailed prompt from person_data returned by Gemini
    hair_desc    = f"{person_data.get('hair_color', '?')} {person_data.get('hair_type', '?')}"
    top_desc     = person_data.get('top_clothing_color', 'unknown')
    bottom_desc  = person_data.get('bottom_clothing_color', 'unknown')
    skin_desc    = person_data.get('skin_color_desc', 'medium')

    def _ldraw_rgb(ldraw_code):
        """Return 'name rgb(R,G,B)' string for a given LDraw color code."""
        info = LDRAW_COLORS.get(int(ldraw_code) if str(ldraw_code).isdigit() else -1)
        if info:
            r, g, b = info["rgb"]
            return f"{info['name']} rgb({r},{g},{b})"
        return str(ldraw_code)

    top_full    = f"{top_desc} {_ldraw_rgb(person_data.get('top_ldraw_code', 15))}"
    bottom_full = f"{bottom_desc} {_ldraw_rgb(person_data.get('bottom_ldraw_code', 72))}"
    skin_full   = f"{skin_desc} {_ldraw_rgb(person_data.get('skin_ldraw_code', 92))}"
    hair_full   = f"{hair_desc} {_ldraw_rgb(person_data.get('hair_ldraw_code', 0))}"

    prompt = (
        f"Recolor this BrickHeadz LEGO {view_label} view template using the reference photo. "
        f"Legs: {bottom_full}. Torso: {top_full}. Skin (face/ears/hands): {skin_full}. "
        f"Hair: {hair_full} — match color and style from photo. "
        f"RULES: Only change colors, never alter shape, structure, size or brick layout. "
        f"Base plate stays exactly 8 studs wide. Use only standard LEGO colors. "
        f"Flat 2D illustration style, solid colors only."
    )

    try:
        ref_url      = fal_client.upload_file(ref_photo_path)
        template_url = fal_client.upload_file(template_path)
    except Exception as e:
        print(f"  [FAL-PARALLEL] {view_label} upload error: {e}")
        return view_label, None

    arguments = {
        "prompt":      prompt,
        "image_urls":  [ref_url, template_url],
        "sync_mode":   False,
        "resolution":  "0.5K",
    }

    try:
        handler = fal_client.submit("fal-ai/nano-banana-2/edit", arguments=arguments)
        result  = handler.get()
        img_url = result["images"][0]["url"]
    except Exception as e:
        print(f"  [FAL-PARALLEL] {view_label} API error: {e}")
        return view_label, None

    try:
        resp = requests.get(img_url, timeout=60)
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(resp.content)
        end_t = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"✅ [FAL-PARALLEL] {view_label} tamamlandı ({end_t}) → {output_path}")
        return view_label, output_path
    except Exception as e:
        print(f"  [FAL-PARALLEL] {view_label} download error: {e}")
        return view_label, None


def generate_all_views_parallel(ref_photo_path: str, person_data: dict,
                                 skip_gen: bool = False) -> dict:
    """
    STEP 2 — Launch all 4 view generations simultaneously via ThreadPoolExecutor.
    Each thread calls fal.ai independently (like apicode1.3.py pattern).
    Execution continues only after ALL 4 views are done.

    Returns
    -------
    dict : { "Front": path, "Right": path, "Back": path, "Left": path }
    """
    labels     = ["Front", "Right", "Back", "Left"]
    view_paths = {}

    # ── Template existence debug ──────────────────────────────────────────────
    print("\n[FAL-PARALLEL] Template kontrol:")
    for label in labels:
        t = TEMPLATE_PATHS.get(label, "TANIM YOK")
        exists = os.path.exists(t) if t != "TANIM YOK" else False
        print(f"  {label:6s} → '{t}'  {'✅ BULUNDU' if exists else '❌ BULUNAMADI'}")

    tasks = []
    for label in labels:
        local_path = os.path.join(GENERATED_DIR, f"generated_{label}.png")

        if skip_gen and os.path.exists(local_path):
            print(f"[FAL-PARALLEL] Reusing cached {label}: {local_path}")
            view_paths[label] = local_path
            continue

        template = TEMPLATE_PATHS.get(label)

        # Template bulunamazsa — mevcut dosyalar arasında benzer isim ara
        if not template or not os.path.exists(template):
            base_dir = os.path.dirname(template) if template else "picture examples"
            candidates = []
            if os.path.isdir(base_dir):
                for fname in os.listdir(base_dir):
                    if label.lower() in fname.lower():
                        candidates.append(os.path.join(base_dir, fname))
            if candidates:
                template = candidates[0]
                print(f"  [FAL-PARALLEL] {label}: template path düzeltildi → '{template}'")
            else:
                print(f"  [FAL-PARALLEL] ❌ {label}: template bulunamadı, atlanıyor.")
                view_paths[label] = None
                continue

        tasks.append((label, ref_photo_path, template, person_data))

    if not tasks:
        print("[FAL-PARALLEL] ❌ Hiç görev yok — template dosyalarını kontrol et!")
        return view_paths

    print(f"\n[FAL-PARALLEL] 🚀 {len(tasks)} view sorgusu AYNI ANDA gönderiliyor (max_workers={len(tasks)})...")
    print("─" * 60)
    total_start = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(tasks)) as executor:
        futures = {executor.submit(_generate_single_view_task, task): task[0] for task in tasks}
        for future in concurrent.futures.as_completed(futures):
            try:
                view_label, local_path = future.result()
                view_paths[view_label] = local_path
            except Exception as e:
                label_name = futures[future]
                print(f"  [FAL-PARALLEL] ❌ {label_name} thread exception: {e}")
                view_paths[label_name] = None

    total_end = time.time()
    print("─" * 60)
    print(f"[FAL-PARALLEL] ✅ Tüm view'lar {total_end - total_start:.1f} sn'de tamamlandı.")

    # Özet
    for lbl in labels:
        status = "✅" if view_paths.get(lbl) else "❌ BAŞARISIZ"
        print(f"  {lbl:6s}: {status}  {view_paths.get(lbl, '')}")

    return view_paths


# =============================================================================
# --- 3. HAIR TYPE IDENTIFICATION VIA CLAUDE API ---
# =============================================================================

HAIR_TYPE_CHOICES = list(HAIR_LDR_MAP.keys())  # canonical labels

def analyze_person(photo_path: str, person_number: int) -> dict:
    """
    STEP 1 — Gemini vision via fal-ai/any-llm/vision
    Analyzes the reference photo ONCE and returns a full appearance profile:
      - hair_type, hair_color, hair_ldraw_code
      - top_clothing_color, top_ldraw_code
      - bottom_clothing_color, bottom_ldraw_code
      - skin_color_desc, skin_ldraw_code

    Result is saved to hair_data_<person_number>.json.
    """
    json_path = f"hair_data_{person_number}.json"

    print(f"\n[GEMINI] Analyzing person appearance from: {photo_path}")
    print(f"  [GEMINI] Uploading photo...")

    image_url = None
    try:
        image_url = fal_client.upload_file(photo_path)
        print(f"  [GEMINI] Upload OK: {image_url}")
    except Exception as e:
        print(f"  [GEMINI] Upload error: {e}")

    ldraw_codes_hint = str({k: v["name"] for k, v in list(LDRAW_COLORS.items())[:20]}) + " ..."

    prompt = (
        "Analyze this person's photo carefully. "
        "Respond ONLY with a valid JSON object (no markdown, no extra text) with exactly these fields:\n"
        "  hair_type          : one of " + str(HAIR_TYPE_CHOICES) + "\n"
        "  hair_color         : short color name (e.g. 'black', 'blonde', 'dark brown')\n"
        "  hair_ldraw_code    : closest LDraw color integer for the hair\n"
        "  top_clothing_color : short color name for the upper body clothing\n"
        "  top_ldraw_code     : closest LDraw color integer for upper clothing\n"
        "  bottom_clothing_color : short color name for lower body clothing\n"
        "  bottom_ldraw_code  : closest LDraw color integer for lower clothing\n"
        "  skin_color_desc    : short description of skin tone (e.g. 'light', 'medium', 'dark')\n"
        "  skin_ldraw_code    : closest LDraw color integer for skin tone\n"
        "  confidence         : float 0-1\n\n"
        "LDraw color reference (partial): " + ldraw_codes_hint + "\n\n"
        "Example output:\n"
        "{\"hair_type\":\"short_straight\",\"hair_color\":\"black\",\"hair_ldraw_code\":0,"
        "\"top_clothing_color\":\"navy blue\",\"top_ldraw_code\":272,"
        "\"bottom_clothing_color\":\"dark gray\",\"bottom_ldraw_code\":72,"
        "\"skin_color_desc\":\"medium\",\"skin_ldraw_code\":92,\"confidence\":0.91}"
    )

    raw = None
    if image_url:
        # fal.ai model IDs change – try multiple in order until one works
        models_to_try = [
            "google/gemini-2.0-flash-001",
            "google/gemini-flash-1-5-8b",
            "google/gemini-flash-1-5",
        ]
        for model_id in models_to_try:
            try:
                start = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                print(f"  [GEMINI] Trying model: {model_id}  ({start})")
                result = fal_client.run(
                    "fal-ai/any-llm/vision",
                    arguments={
                        "model":     model_id,
                        "prompt":    prompt,
                        "image_url": image_url,
                    },
                )
                end = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                print(f"  [GEMINI] Full result dict: {result}")  # DEBUG

                # Extract text – fal returns {"output":"..."} but key can vary
                if isinstance(result, str):
                    raw = result.strip()
                elif isinstance(result, dict):
                    raw = (
                        result.get("output")
                        or result.get("text")
                        or result.get("content")
                        or result.get("response")
                        or ""
                    )
                    raw = raw.strip() if raw else ""

                print(f"  [GEMINI] Extracted raw ({end}): {raw}")
                if raw:
                    break   # success – stop trying other models
            except Exception as e:
                print(f"  [GEMINI] Model {model_id} error: {e}")

    if raw:
        raw = raw.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

    try:
        person_data = json.loads(raw) if raw else {}
        if not person_data:
            raise ValueError("Empty response")
    except (json.JSONDecodeError, ValueError):
        print("  [GEMINI] WARNING: Could not parse JSON, using defaults.")
        person_data = {
            "hair_type":             "default",
            "hair_color":            "unknown",
            "hair_ldraw_code":       0,
            "top_clothing_color":    "unknown",
            "top_ldraw_code":        72,
            "bottom_clothing_color": "unknown",
            "bottom_ldraw_code":     72,
            "skin_color_desc":       "medium",
            "skin_ldraw_code":       92,
            "confidence":            0.0,
        }

    # Validate hair_type
    if person_data.get("hair_type") not in HAIR_LDR_MAP:
        print(f"  [GEMINI] Unknown hair_type '{person_data.get('hair_type')}', defaulting.")
        person_data["hair_type"] = "default"

    person_data["person_number"] = person_number

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(person_data, f, indent=2, ensure_ascii=False)

    print(f"\n  [GEMINI] ✅ Appearance data saved → {json_path}")
    print(f"  [GEMINI]   Hair        : {person_data['hair_type']} / {person_data['hair_color']} (LDraw {person_data['hair_ldraw_code']})")
    print(f"  [GEMINI]   Top clothes : {person_data['top_clothing_color']} (LDraw {person_data['top_ldraw_code']})")
    print(f"  [GEMINI]   Bottom      : {person_data['bottom_clothing_color']} (LDraw {person_data['bottom_ldraw_code']})")
    print(f"  [GEMINI]   Skin        : {person_data['skin_color_desc']} (LDraw {person_data['skin_ldraw_code']})")
    return person_data


# =============================================================================
# --- 4. GRID PERSPECTIVE ---
# (unchanged from original – accepts a file path)
# =============================================================================

def grid_perspective(path):

    img = cv2.imread(path)

    img_display = img.copy()

    h, w = img.shape[:2]

    mask = np.zeros(img.shape[:2], np.uint8)
    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    rect = (int(w*0.05), int(h*0.02), int(w*0.9), h - int(h*0.02) - 1)


    cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)

    
    binary_view = np.where((mask == 1) | (mask == 3), 0, 255).astype('uint8')
    kernel = np.ones((5,5), np.uint8)
    clean_binary = cv2.morphologyEx(binary_view, cv2.MORPH_OPEN, kernel, iterations=2)

    
    inv_binary = cv2.bitwise_not(clean_binary)

    contours, _ = cv2.findContours(inv_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        
        cv2.drawContours(img_display, contours, -1, (0, 255, 0), 3)

        points = largest_contour.reshape(-1, 2)

        max_y = np.max(points[:, 1])
        min_y = np.min(points[:, 1])

        bottom_points = points[points[:, 1] == max_y]
        top_points = points[points[:,1] == min_y] 

        bottom_left = bottom_points[bottom_points[:, 0].argmin()]
        bottom_right = bottom_points[bottom_points[:, 0].argmax()]
        top_left = top_points[top_points[:,0].argmin()]
        top_right = top_points[top_points[:,0].argmax()]

        distance_bottom = np.linalg.norm(bottom_right - bottom_left)
        distance_top = np.linalg.norm(top_right - top_left)
        distance_left = np.linalg.norm(top_left - bottom_left)
        distance_right = np.linalg.norm(top_right - bottom_right)


        print(f"Bottom Left Point: {bottom_left}")
        print(f"Bottom Right Point: {bottom_right}")
        print(f"Distance bottom: {distance_bottom:.2f} pixels")
        print(f"Distance top: {distance_top:.2f} pixels")
        print(f"Distance right: {distance_right:.2f} pixels")
        print(f"Distance left: {distance_left:.2f} pixels")

        cv2.circle(img_display, tuple(bottom_left), 10, (255, 0, 0), -1)
        cv2.circle(img_display, tuple(bottom_right), 10, (0, 0, 255), -1)
        cv2.circle(img_display, tuple(top_left), 10, (255, 0, 0), -1)
        cv2.circle(img_display, tuple(top_right), 10, (0, 0, 255), -1)

    if abs(distance_bottom - distance_top) <= 3 and abs(distance_left - distance_right) <= 3:

        width_px = distance_bottom/8.0
        height_px = distance_left/8.0

        output_img = img.copy()
        grid_color = (255, 255, 0)

        left_x = bottom_points[:, 0].min()
        right_x =  bottom_points[:, 0].max()
        top_y =  points[:, 1].min()
        bottom_y =  points[:, 1].max()

        cursor_y = bottom_y - height_px * 2
        cursor_x = left_x + width_px * 2

        y_coords = []
        while cursor_y >= top_y + height_px*2:

            # cv2.line(image, (start_x, start_y), (end_x, end_y), color, thickness)
            start_point = (int(left_x+width_px*2), int(cursor_y))
            end_point = (int(right_x-width_px*2), int(cursor_y))
    
            cv2.line(output_img, start_point, end_point, grid_color, 1)
    
            # Move the cursor up by your calculated height
            y_coords.append(int(cursor_y))
            cursor_y -= height_px 

        x_coords = []
        while cursor_x <= right_x - width_px*0.9:

            # cv2.line(image, (start_x, start_y), (end_x, end_y), color, thickness)
            start_point = (int(cursor_x), int(top_y))
            end_point = (int(cursor_x), int(bottom_y))
    
            cv2.line(output_img, start_point, end_point, grid_color, 1)
    
            # Move the cursor right by your calculated height
            x_coords.append(int(cursor_x))
            cursor_x += width_px

    else:

        width_px = distance_bottom/8.0
        height_px = width_px*0.4

        output_img = img.copy()
        grid_color = (255, 255, 0)

        left_x = bottom_points[:, 0].min()
        right_x =  bottom_points[:, 0].max()
        top_y =  points[:, 1].min()
        bottom_y =  points[:, 1].max()

        cursor_y = bottom_y
        cursor_x = left_x + width_px * 2

        y_coords = []
        while cursor_y >= top_y:

            # cv2.line(image, (start_x, start_y), (end_x, end_y), color, thickness)
            start_point = (int(left_x+width_px*2), int(cursor_y))
            end_point = (int(right_x-width_px*2), int(cursor_y))
    
            cv2.line(output_img, start_point, end_point, grid_color, 1)
    
            # Move the cursor up by your calculated height
            y_coords.append(int(cursor_y))
            cursor_y -= height_px

        x_coords = []
        while cursor_x <= right_x - width_px * 2:

            # cv2.line(image, (start_x, start_y), (end_x, end_y), color, thickness)
            start_point = (int(cursor_x), int(top_y))
            end_point = (int(cursor_x), int(bottom_y))
    
            cv2.line(output_img, start_point, end_point, grid_color, 1)
    
            # Move the cursor right by your calculated height
            x_coords.append(int(cursor_x))
            cursor_x += width_px

    return output_img, x_coords, y_coords, inv_binary


# =============================================================================
# --- 5. SEGMENT FOREGROUND ---
# =============================================================================

def _segment_foreground(img):
    h, w = img.shape[:2]
    mask     = np.zeros((h, w), np.uint8)
    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    rect     = (int(w * 0.05), int(h * 0.02), int(w * 0.9), h - int(h * 0.02) - 1)

    cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)

    bg_reference_mask = np.zeros((h, w), np.uint8)
    cv2.rectangle(bg_reference_mask,
                  (rect[0], rect[1]),
                  (rect[0] + rect[2], rect[1] + rect[3]), 0, -1)
    bg_reference_mask = cv2.bitwise_not(bg_reference_mask)

    mean_bg_color = cv2.mean(img, mask=bg_reference_mask)[:3]
    diff      = cv2.absdiff(img, np.array(mean_bg_color, dtype=np.uint8))
    mask_diff = np.all(diff < [20, 20, 20], axis=2)
    mask[mask_diff & (mask == cv2.GC_PR_FGD)] = cv2.GC_PR_BGD

    cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
    binary_mask  = np.where((mask == 1) | (mask == 3), 255, 0).astype("uint8")
    kernel       = np.ones((3, 3), np.uint8)
    clean_binary = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    contours, _  = cv2.findContours(clean_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return clean_binary, contours


# =============================================================================
# --- 6. FIND ARM ---
# =============================================================================

def find_arm(path):
    STUDS              = 8
    ARM_RATIO          = 5.6 / 8.0
    WIDTH_TOLERANCE_PX = 3.0
    Y_BAND_PX          = 2

    img = cv2.imread(path)
    if img is None:
        print(f"[find_arm] ERROR: could not read '{path}'")
        return None

    clean_binary, contours = _segment_foreground(img)
    if not contours:
        return None

    all_points   = np.vstack(contours).reshape(-1, 2)
    max_y        = np.max(all_points[:, 1])
    min_y        = np.min(all_points[:, 1])
    bottom_points = all_points[all_points[:, 1] == max_y]
    top_points    = all_points[all_points[:, 1] == min_y]
    bottom_left   = bottom_points[bottom_points[:, 0].argmin()]
    bottom_right  = bottom_points[bottom_points[:, 0].argmax()]
    top_left      = top_points[top_points[:, 0].argmin()]

    distance_bottom = np.linalg.norm(bottom_right - bottom_left)
    width_px  = distance_bottom / STUDS
    height_px = width_px * 0.4

    if width_px <= 0 or height_px <= 0:
        return None

    bottom_y     = int(max_y)
    top_y        = int(min_y)
    target_width = distance_bottom * ARM_RATIO
    arms_coords  = []
    cursor_y     = bottom_y

    while cursor_y >= top_y:
        y_int = int(round(cursor_y))
        y_lo  = max(y_int - Y_BAND_PX, 0)
        y_hi  = min(y_int + Y_BAND_PX + 1, clean_binary.shape[0])
        row_band = clean_binary[y_lo:y_hi, :]
        fg_cols  = np.where(row_band.any(axis=0))[0]
        if len(fg_cols) > 0:
            left  = fg_cols[0]
            right = fg_cols[-1]
            if abs((right - left) - target_width) <= WIDTH_TOLERANCE_PX:
                arms_coords.append([left, y_int])
                arms_coords.append([right, y_int])
        cursor_y -= height_px

    if not arms_coords:
        return None

    arms_coords_np = np.array(arms_coords)
    arms_coordinate = tuple(np.min(arms_coords_np, axis=0))
    arms_block      = arms_coordinate[1]
    block_count     = (bottom_y - arms_block) / height_px
    return round(block_count)


# =============================================================================
# --- 7. OCCUPANCY MATRIX ---
# =============================================================================

skin_color = None
arms_top   = None
counter    = 0


def calculate_occupancy_matrices(image, binary_mask, x_lines, y_lines, threshold=0.5):
    global skin_color, counter
    x_lines = sorted(list(set([int(x) for x in x_lines])))
    y_lines = sorted(list(set([int(y) for y in y_lines])))
    rows    = len(y_lines) - 1
    cols    = len(x_lines) - 1

    if rows <= 0 or cols <= 0:
        return np.zeros((0, 0)), np.zeros((0, 0)), 0, 0

    occ = np.zeros((rows, cols), dtype=int)
    col = np.full((rows, cols), 15, dtype=int)

    for r in range(rows):
        for c in range(cols):
            y1, y2 = y_lines[r], y_lines[r + 1]
            x1, x2 = x_lines[c], x_lines[c + 1]
            mask_roi = binary_mask[y1:y2, x1:x2]
            if mask_roi.size == 0:
                continue
            if (np.count_nonzero(mask_roi) / mask_roi.size) > threshold:
                occ[r, c] = 1
                mx, my = int((x2 - x1) * 0.2), int((y2 - y1) * 0.2)
                roi    = image[y1 + my: y2 - my, x1 + mx: x2 - mx]
                col[r, c] = get_dominant_color(roi)
            if counter == 0 and arms_top is not None and r == rows - arms_top - 3 and c == 1:
                skin_color = col[r, c]

    return np.flipud(occ), np.flipud(col), cols, rows


# =============================================================================
# --- 8. 3D SPACE MATRIX (4-VIEW, FORCED DEPTH=4 SOLID) ---
# Top view removed. Depth axis is always set to 4 (a full 4×4 solid block).
# Every (i, j, k) cell that is visible from Front AND Left is filled solid;
# the entire depth column (j = 0..3) is occupied so the model is never hollow.
# Color is assigned by nearest-surface rule using the 4 side views only.
# =============================================================================

FORCED_DEPTH = 4  # Always produce a solid 4-stud-deep body

def calculate_space_matrices(data_map):
    occ_f, col_f = data_map[0]["occ"], data_map[0]["col"]
    occ_r, col_r = data_map[1]["occ"], data_map[1]["col"]
    occ_b, col_b = data_map[2]["occ"], data_map[2]["col"]
    occ_l, col_l = data_map[3]["occ"], data_map[3]["col"]
 
    h = min(occ_f.shape[0], occ_l.shape[0])
    w = min(occ_f.shape[1], occ_b.shape[1])
    d = FORCED_DEPTH  # always 4 – no top view
 
    space_matrix = np.full((w, d, h), -1, dtype=int)
 
    for i in range(w):
        for j in range(d):
            for k in range(h):
                # Orijinal mantık: front VE left silhouette'te dolu olmalı
                f_occ = occ_f[k, i] == 1 if i < occ_f.shape[1] else False
                l_occ = occ_l[k, j] == 1 if j < occ_l.shape[1] else False
 
                if not (f_occ and l_occ):
                    continue
 
                dist_front = j
                dist_back  = (d - 1) - j
                dist_left  = i
                dist_right = (w - 1) - i
 
                min_dist    = min(dist_front, dist_back, dist_left, dist_right)
                final_color = 15
 
                if min_dist == dist_front:
                    final_color = col_f[k, i]
                elif min_dist == dist_back:
                    c_idx = min(i, col_b.shape[1] - 1)
                    final_color = col_b[k, c_idx]
                elif min_dist == dist_left:
                    j_idx = min(j, col_l.shape[1] - 1)
                    final_color = col_l[k, j_idx]
                elif min_dist == dist_right:
                    j_idx = min(j, col_r.shape[1] - 1)
                    final_color = col_r[k, j_idx]
 
                space_matrix[i, j, k] = final_color
 
    return space_matrix
 

# =============================================================================
# --- 9. BRICK MERGING ---
# =============================================================================

LEGO_PART_MAP = {
    (1, 1): "3024.dat",
    (2, 1): "3023.dat",
    (2, 2): "3022.dat",
    (3, 1): "3623.dat",
    (4, 1): "3710.dat",
    (3, 2): "3021.dat",
    (4, 2): "3020.dat",
}

STANDARD_BRICK_SIZES = [
    (4, 2), (2, 4),
    (4, 1), (1, 4),
    (3, 2), (2, 3),
    (3, 1), (1, 3),
    (2, 2),
    (2, 1), (1, 2),
    (1, 1),
]


def get_part_and_rotation(brick_cols, brick_rows):
    if brick_cols >= brick_rows:
        key      = (brick_cols, brick_rows)
        rotation = "1 0 0 0 1 0 0 0 1"
    else:
        key      = (brick_rows, brick_cols)
        rotation = "0 0 -1 0 1 0 1 0 0"
    part = LEGO_PART_MAP.get(key, "3024.dat")
    return part, rotation


def _can_place(layer_2d, visited, r, c, brick_rows, brick_cols, color):
    rows, cols = layer_2d.shape
    if r + brick_rows > rows or c + brick_cols > cols:
        return False
    region = layer_2d[r:r + brick_rows, c:c + brick_cols]
    vis    = visited[r:r + brick_rows, c:c + brick_cols]
    return bool(np.all(region == color) and not np.any(vis))


def merge_layer(layer_2d, layer_no):
    rows, cols = layer_2d.shape
    visited = np.zeros((rows, cols), dtype=bool)
    merged  = []

    if arms_top is not None:
        if arms_top - 5 <= layer_no <= arms_top - 1:
            visited[1:3, 0] = True
            visited[1:3, 3] = True
        if layer_no >= arms_top + 1:
            visited[0:4, 0:4] = True

    for r in range(rows):
        for c in range(cols):
            if visited[r, c] or layer_2d[r, c] == -1:
                continue
            color  = int(layer_2d[r, c])
            placed = False
            for (bc, br) in STANDARD_BRICK_SIZES:
                if _can_place(layer_2d, visited, r, c, br, bc, color):
                    visited[r:r + br, c:c + bc] = True
                    merged.append((c, r, bc, br, color))
                    placed = True
                    break
            if not placed:
                visited[r, c] = True
                merged.append((c, r, 1, 1, color))

    return merged


def merge_space_matrix_by_layer(space_matrix):
    W, D, H      = space_matrix.shape
    all_merged   = []
    for z in range(H):
        layer_2d = space_matrix[:, :, z].T
        for (grid_col, grid_row, bc, br, color) in merge_layer(layer_2d, z):
            all_merged.append((grid_col, grid_row, z, bc, br, color))
    print(f"Total merged bricks across all layers: {len(all_merged)}")
    return all_merged


# =============================================================================
# --- 10. LDR SAVE ---
# =============================================================================

def save_to_ldr(space_matrix, filename):
    W, D, H = space_matrix.shape
    STUD    = 20
    PLATE_H = 8
    with open(filename, "w", encoding="utf-8") as f:
        f.write("0 LEGO BrickHeadz Model\n")
        f.write("0 Name: Generated\n")
        for x in range(W):
            for y in range(D):
                for z in range(H):
                    code = space_matrix[x, y, z]
                    if code != -1:
                        f.write(f"1 {code} {x*STUD} {-(z*PLATE_H)} {y*STUD} 1 0 0 0 1 0 0 0 1 3024.dat\n")
    print(f"LDR file saved: {filename}")


def save_merged_to_ldr(space_matrix, head_filename, output_filename, hair_data: dict = None):
    """
    Build the merged LDR model, append the head LDR, and insert the
    correct hair-style snippet chosen from hair_data.

    Parameters
    ----------
    hair_data : dict returned by analyze_person(), or None.
                Expected keys: hair_type, ldraw_color_code.
    """
    STUD    = 20
    PLATE_H = 8

    merged_blocks = merge_space_matrix_by_layer(space_matrix)

    if merged_blocks:
        max_gz   = max(block[2] for block in merged_blocks)
    else:
        max_gz   = 0

    offset_y = -(max_gz + 1) * PLATE_H

    # Determine hair snippet path
    hair_type    = hair_data.get("hair_type", "default")       if hair_data else "default"
    hair_color   = hair_data.get("hair_ldraw_code", 0)         if hair_data else 0
    hair_snippet = HAIR_LDR_MAP.get(hair_type, HAIR_LDR_MAP["default"])

    print(f"\n[HAIR] Using hair type  : {hair_type}")
    print(f"[HAIR] Using hair color : LDraw code {hair_color}")
    print(f"[HAIR] Using LDR snippet: {hair_snippet}")

    with open(output_filename, "w", encoding="utf-8") as f_out:
        f_out.write("0 LEGO Merged Model with Head\n")
        f_out.write(f"0 Name: Person {hair_data.get('person_number', '?') if hair_data else '?'}\n")
        f_out.write("0\n")

        # ── JSON appearance data embedded as LDR comments ─────────────────────
        if hair_data:
            f_out.write("0 // -- Appearance Data (from hair_data JSON) --\n")
            f_out.write(f"0 //   person_number      : {hair_data.get('person_number', '?')}\n")
            f_out.write(f"0 //   hair_type          : {hair_data.get('hair_type', '?')}\n")
            f_out.write(f"0 //   hair_color         : {hair_data.get('hair_color', '?')}\n")
            f_out.write(f"0 //   hair_ldraw_code    : {hair_data.get('hair_ldraw_code', '?')}\n")
            f_out.write(f"0 //   top_clothing_color : {hair_data.get('top_clothing_color', '?')}\n")
            f_out.write(f"0 //   top_ldraw_code     : {hair_data.get('top_ldraw_code', '?')}\n")
            f_out.write(f"0 //   bottom_clothing    : {hair_data.get('bottom_clothing_color', '?')}\n")
            f_out.write(f"0 //   bottom_ldraw_code  : {hair_data.get('bottom_ldraw_code', '?')}\n")
            f_out.write(f"0 //   skin_color         : {hair_data.get('skin_color_desc', '?')}\n")
            f_out.write(f"0 //   skin_ldraw_code    : {hair_data.get('skin_ldraw_code', '?')}\n")
            f_out.write(f"0 //   confidence         : {hair_data.get('confidence', '?')}\n")
            f_out.write("0\n")

        # Arms
        arms_posx  = 0
        arms_posz  = 1.5 * STUD
        arms_posy  = -((arms_top - 1) * PLATE_H) if arms_top else 0

        f_out.write(f"1 {15} {arms_posx} {arms_posy} {arms_posz} "
                    f"0 0 1 0 1 0 -1 0 0 22885.dat\n")
        f_out.write(f"1 {15} {3*STUD} {arms_posy} {arms_posz} "
                    f"0 0 -1 0 1 0 1 0 0 22885.dat\n")

        armsplate_posx  = arms_posx - 18.0
        armsplate_posy  = arms_posy + 20
        f_out.write(f"1 {15} {armsplate_posx} {armsplate_posy} {arms_posz} "
                    f"0 1 0 -1 0 0 0 0 1 3022.dat\n")
        f_out.write(f"1 {15} {3*STUD+18.0} {armsplate_posy} {arms_posz} "
                    f"0 -1 0 1 0 0 0 0 1 3022.dat\n")

        armsmod_posy  = arms_posy + 30
        sc = skin_color if skin_color is not None else 92
        f_out.write(f"1 {sc} {arms_posx-26.0} {armsmod_posy} {arms_posz} "
                    f"0 1 0 0 0 -1 -1 0 0 11476.dat\n")
        f_out.write(f"1 {sc} {3*STUD+26.0} {armsmod_posy} {arms_posz} "
                    f"0 -1 -0.000001 0 0 -1 1 0 0 11476.dat\n")

        # Head
        print(f"  [HEAD] Looking for head file: '{head_filename}'")
        print(f"  [HEAD] File exists: {os.path.exists(head_filename)}")
        if os.path.exists(head_filename):
            # arms_top = omuz katmanı (body layer index).
            # Head LDR'da Y negatif = yukarı yön.
            # Omuz hizasının üstündeki brick'ler (saç dahil) atlanır;
            # onların yerine ayrı hair snippet ekleniyor.
            # Head LDR kendi koordinat sisteminde yazılmış (offset henüz eklenmemiş),
            # bu yüzden eşiği offset_y'ye göre değil ham Y'ye göre hesaplıyoruz.
            # Omuz hizası: body'de arms_top layer → head'de buna karşılık gelen
            # en yüksek (en negatif) Y sınırını bulmak için head'in tüm Y'lerini tarayıp
            # en tepedeki arms_top kadar layer'ı atlıyoruz.

            # Pass 1: head LDR'daki tüm unique Y'leri topla
            head_y_layers = set()
            with open(head_filename, "r", encoding="utf-8") as f_scan:
                for line in f_scan:
                    p = line.strip().split()
                    if p and p[0] == "1" and len(p) >= 15:
                        head_y_layers.add(float(p[3]))

            # Küçükten büyüğe sırala → en negatif = en tepedeki layer
            sorted_y = sorted(head_y_layers)

            # arms_top kadar üst layer'ı atla (bunlar saç + üst kafayla örtüşen alan)
            skip_count = arms_top if arms_top else 0
            skip_y     = set(sorted_y[:skip_count])
            print(f"  [HEAD] Total Y layers : {len(sorted_y)}")
            print(f"  [HEAD] Skipping top {skip_count} layers (arms_top={arms_top}): {sorted(skip_y)}")

            # Pass 2: head'i yaz, üst katmanları atla
            f_out.write("0 // --- Head Start (top layers skipped via arms_top) ---\n")
            with open(head_filename, "r", encoding="utf-8") as f_head:
                for line in f_head:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if parts[0] == "1" and len(parts) >= 15:
                        orig_y = float(parts[3])
                        if orig_y in skip_y:
                            continue          # omuz üstü → saç snippet'e bırak
                        parts[3] = f"{orig_y + offset_y:.6f}"
                        if parts[1] == "71":
                            parts[1] = str(sc)
                        f_out.write(" ".join(parts) + "\n")
                    elif parts[0] == "0" and "FILE" not in line and "Name:" not in line:
                        f_out.write(line + "\n")
            f_out.write("0 // --- Head End ---\n\n")

        # ── HAIR SNIPPET ──────────────────────────────────────────────────────
        if os.path.exists(hair_snippet):
            f_out.write(f"0 // --- Hair ({hair_type}) Start ---\n")
            with open(hair_snippet, "r", encoding="utf-8") as f_hair:
                for line in f_hair:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if parts[0] == "1" and len(parts) >= 15:
                        orig_y   = float(parts[3])
                        parts[3] = f"{orig_y + offset_y:.6f}"
                        # Recolor any placeholder color (e.g. 999) to detected hair color
                        if parts[1] == "999":
                            parts[1] = str(hair_color)
                        f_out.write(" ".join(parts) + "\n")
                    elif parts[0] == "0" and "FILE" not in line and "Name:" not in line:
                        f_out.write(line + "\n")
            f_out.write(f"0 // --- Hair ({hair_type}) End ---\n\n")
        else:
            print(f"  [HAIR] WARNING: snippet not found at '{hair_snippet}', skipping hair layer.")

        # Body
        f_out.write("0 // --- Body Start ---\n")
        for (gx, gy, gz, bc, br, color) in merged_blocks:
            if color == -1:
                continue
            part, rotation = get_part_and_rotation(bc, br)
            pos_x = gx * STUD + (bc - 1) * STUD // 2
            pos_y = -(gz * PLATE_H)
            pos_z = gy * STUD + (br - 1) * STUD // 2
            f_out.write(f"1 {color} {pos_x} {pos_y} {pos_z} {rotation} {part}\n")

    print(f"\nDone! Model saved: {output_filename}")


# =============================================================================
# --- 11. MAIN ---
# =============================================================================

def main():
    global arms_top, counter, skin_color

    parser = argparse.ArgumentParser(description="Generate a BrickHeadz LDR model from a photo.")
    parser.add_argument("--photo",    required=True, help="Path to reference portrait photo.")
    parser.add_argument("--number",   type=int, default=1,
                        help="Person ID number (used for hair_data_<N>.json).")
    parser.add_argument("--skip-gen", action="store_true",
                        help="Reuse previously generated view images (skip fal.ai calls).")
    args = parser.parse_args()

    # ── STEP 1: Gemini analyzes photo → saves hair_data_N.json ─────────────────
    person_data = analyze_person(args.photo, args.number)

    # ── STEP 2: 4 view images generated IN PARALLEL via fal.ai ───────────────
    view_paths = generate_all_views_parallel(args.photo, person_data, skip_gen=args.skip_gen)

    # Order expected by the pipeline: Front, Right, Back, Left  (Top removed)
    ordered_labels  = ["Front", "Right", "Back", "Left"]
    image_paths     = [view_paths.get(lbl) for lbl in ordered_labels]

    # Check we have the front view at minimum for arm detection
    if not image_paths[0]:
        print("ERROR: Front view image could not be generated. Aborting.")
        return

    # ── STEP 3: Arm detection ─────────────────────────────────────────────────
    arms_top = find_arm(image_paths[0])
    print(f"\n[MAIN] Arm top layer: {arms_top}")

    # ── STEP 4: Grid analysis for each view ───────────────────────────────────
    data_collection = []
    counter = 0
    skin_color = None

    for idx, path in enumerate(image_paths):
        label = ordered_labels[idx]
        print(f"\n--- Processing: {label} ({path}) ---")
        if not path or not os.path.exists(path):
            print(f"ERROR: Image not available for {label}. Skipping.")
            data_collection.append(None)
            continue

        img, xc, yc, inv_bin = grid_perspective(path)
        if img is None:
            print(f"ERROR: grid_perspective failed for {path}")
            data_collection.append(None)
            continue

        occ, col, c, r = calculate_occupancy_matrices(img, inv_bin, xc, yc)
        counter += 1
        data_collection.append({"occ": occ, "col": col, "skin_color": skin_color})
        print(f"Color matrix ({label}):\n{col}")

    # Filter out None entries
    valid = [d for d in data_collection if d is not None]

    if len(valid) == 4:
        print("\n[MAIN] Building 3D space matrix (forced depth=4, no top view) ...")
        final_matrix = calculate_space_matrices(valid)

        # Dosya isimlerini JSON'daki person_number'dan türet
        n             = person_data.get("person_number", args.number)
        hair_type_key = person_data.get("hair_type", "default")
        head_file     = HAIR_LDR_MAP.get(hair_type_key, HAIR_LDR_MAP["default"])
        output_file   = f"model_merged_{n}.ldr"

        save_merged_to_ldr(
            final_matrix,
            head_filename=head_file,
            output_filename=output_file,
            hair_data=person_data,
        )
        print("\nFiles created:")
        print(f"  {output_file}  – complete model with hair snippet")
        print(f"  hair_data_{n}.json – full appearance data (hair, clothes, skin)")
    else:
        print(f"\nMissing images ({len(valid)}/4 loaded). Check paths and fal.ai API key.")


if __name__ == "__main__":
    main()