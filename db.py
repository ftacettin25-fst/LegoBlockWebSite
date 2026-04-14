import os
import datetime
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


def upload_file_to_storage(local_file_path: str, remote_file_name: str) -> str:
    """
    Uploads a local file to Firebase Storage and returns a signed URL
    valid for 7 days. Signed URLs work from any browser without CORS issues.
    """
    bucket = storage.bucket()
    blob = bucket.blob(remote_file_name)
    blob.upload_from_filename(local_file_path)

    # Generate a signed URL valid for 7 days — works in any browser, no CORS issues
    signed_url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(days=7),
        method="GET",
    )
    return signed_url