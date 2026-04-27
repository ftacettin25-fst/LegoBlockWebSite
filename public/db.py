import os
import firebase_admin
from firebase_admin import credentials, storage, firestore
import traceback

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
            "Firebase Console -> Project Settings -> Service Accounts -> "
            "Generate new private key -> 'firebase_key.json' olarak kaydet."
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

def add_review(user_name: str, rating: int, comment: str, job_id: str = None) -> bool:
    """Save a review and update global stats."""
    if not _initialized:
        return False
    try:
        db = firestore.client()
        
        # Add the review document
        review_doc = {
            "user_name": user_name,
            "rating": max(1, min(5, rating)), # clamp between 1 and 5
            "comment": comment,
            "job_id": job_id,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        db.collection("reviews").add(review_doc)
        
        # Update aggregate stats
        stats_ref = db.collection("stats").document("reviews")
        
        @firestore.transactional
        def update_in_transaction(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                new_total = 1
                new_sum = rating
            else:
                data = snapshot.to_dict()
                new_total = data.get("total_reviews", 0) + 1
                new_sum = data.get("sum_ratings", 0) + rating
                
            transaction.set(ref, {
                "total_reviews": new_total,
                "sum_ratings": new_sum,
                "average_rating": new_sum / new_total
            })

        transaction = db.transaction()
        update_in_transaction(transaction, stats_ref)
        
        return True
    except Exception as e:
        print(f"[Firebase] add_review error: {e}")
        traceback.print_exc()
        return False

def get_reviews(limit: int = 10) -> dict:
    """Fetch global stats and a list of recent reviews."""
    if not _initialized:
        return {"stats": {"total_reviews": 0, "average_rating": 0.0}, "reviews": []}
    try:
        db = firestore.client()
        
        # Get stats
        stats_doc = db.collection("stats").document("reviews").get()
        stats = stats_doc.to_dict() if stats_doc.exists else {"total_reviews": 0, "average_rating": 0.0}
        
        # Get recent reviews
        reviews_query = db.collection("reviews").order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
        reviews = []
        for doc in reviews_query.stream():
            data = doc.to_dict()
            # remove created_at timestamp to avoid json serialization issues
            if "created_at" in data:
                del data["created_at"]
            reviews.append(data)
            
        return {"stats": stats, "reviews": reviews}
    except Exception as e:
        print(f"[Firebase] get_reviews error: {e}")
        return {"stats": {"total_reviews": 0, "average_rating": 0.0}, "reviews": []}