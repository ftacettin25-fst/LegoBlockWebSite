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
    
    # Sadece Storage'ı başlatıyoruz
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'legoproje-c4094.firebasestorage.app'
    })
    
    _initialized = True
    print("[Firebase] Storage Initialized (No Database).")

def upload_file_to_storage(local_file_path: str, remote_file_name: str) -> str:
    """Yerel dosyayı Firebase Storage'a yükler ve public (açık) URL döner."""
    bucket = storage.bucket()
    blob = bucket.blob(remote_file_name)
    blob.upload_from_filename(local_file_path)
    blob.make_public()
    return blob.public_url