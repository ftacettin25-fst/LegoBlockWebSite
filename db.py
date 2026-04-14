import os
import firebase_admin
from firebase_admin import credentials, storage

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