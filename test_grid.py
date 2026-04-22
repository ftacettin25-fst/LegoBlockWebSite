import sys
import os
import cv2
import matplotlib.pyplot as plt
import argparse

# Import the actual functions directly from your main script
# This ensures it uses the exact same generation logic!
from head_add_improved import analyze_person, generate_all_views_parallel, grid_perspective

def main():
    parser = argparse.ArgumentParser(description="Test grid perspective with Fal.ai generation.")
    parser.add_argument("--photo", required=True, help="Path to reference portrait photo.")
    parser.add_argument("--skip-gen", action="store_true", help="Reuse previously generated view images (skip fal.ai calls).")
    args = parser.parse_args()

    photo_path = args.photo
    if not os.path.exists(photo_path):
        print(f"Error: Photo '{photo_path}' not found!")
        return

    print(f"--- 1. Analyzing Person with Gemini (via Fal.ai) ---")
    person_data = analyze_person(photo_path, 1)

    print(f"\n--- 2. Generating Views with Fal.ai ---")
    # This will call Fal.ai to generate the images just like the main code
    view_paths = generate_all_views_parallel(photo_path, person_data, skip_gen=args.skip_gen)

    ordered_labels = ["Front", "Right", "Back", "Left"]
    image_paths = [view_paths.get(lbl) for lbl in ordered_labels]

    print(f"\n--- 3. Testing Grids ---")
    for idx, path in enumerate(image_paths):
        label = ordered_labels[idx]
        if not path or not os.path.exists(path):
            print(f"File not found or failed to generate for {label}. Skipping...")
            continue
            
        print(f"\nProcessing {label} view: {path}")
        output_img, xc, yc, inv_bin = grid_perspective(path)
        
        if output_img is None:
            print("Failed to process image.")
            continue
            
        # Convert BGR to RGB for correct matplotlib color display
        img_rgb = cv2.cvtColor(output_img, cv2.COLOR_BGR2RGB)
        
        plt.figure(figsize=(8, 10))
        plt.title(f"{label} View - Grid Perspective")
        plt.imshow(img_rgb)
        
        grid_width = len(xc) - 1
        grid_height = len(yc) - 1
        
        info_text = f"Cols (width): {grid_width}\nRows (height): {grid_height}"
        plt.text(10, 30, info_text, color='black', backgroundcolor='yellow', fontsize=12, fontweight='bold')
        
        plt.axis('off')
        plt.show()

if __name__ == "__main__":
    main()
