import os
import firebase_admin
from firebase_admin import credentials, storage, firestore

_initialized = False

def init_firebase(key_path: str = None):
    global _initialized
    if _initialized:
        return

    key_path = (
        key_path
        or os.environ.get("FIREBASE_KEY_PATH")
        or "firebase_key.json"
    )

    if not os.path.exists(key_path):
        raise FileNotFoundError(
            f"Firebase key bulunamadi: '{key_path}'\n"
            "Firebase Console → Project Settings → Service Accounts → "
            "Generate new private key → 'firebase_key.json' olarak kaydet."
        )

    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'legoproje-c4094.firebasestorage.app'
    })
    _initialized = True
    print("[Firebase] Storage Initialized.")


def upload_blob_to_storage(local_file_path: str, remote_blob_path: str) -> None:
    """
    Upload a local file to Firebase Storage.
    The blob path (e.g. 'jobs/abc123/file.ldr') is used by the Flask proxy
    routes (/api/download/<path> and /api/ldr/<path>) to serve the file
    through the same origin — no CORS, download attribute works correctly.
    """
    bucket = storage.bucket()
    blob = bucket.blob(remote_blob_path)
    blob.upload_from_filename(local_file_path)
    print(f"[Firebase] Uploaded: {remote_blob_path}")

def get_counter() -> int:
    """Read the current global generation counter from Firestore."""
    if not _initialized:
        return 0
    try:
        db = firestore.client()
        doc_ref = db.collection("stats").document("global")
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict().get("total_models", 0)
        else:
            # Initialize if not exists
            doc_ref.set({"total_models": 0})
            return 0
    except Exception as e:
        print(f"[Firebase] get_counter error: {e}")
        return 0

def increment_counter() -> int:
    """Increment the global generation counter in Firestore."""
    if not _initialized:
        return 0
    try:
        db = firestore.client()
        doc_ref = db.collection("stats").document("global")
        # Use Firestore increment
        doc_ref.set({"total_models": firestore.Increment(1)}, merge=True)
        # Read the new value
        return doc_ref.get().to_dict().get("total_models", 0)
    except Exception as e:
        print(f"[Firebase] increment_counter error: {e}")
        return 0