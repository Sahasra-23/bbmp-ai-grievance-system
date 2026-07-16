from pathlib import Path

import joblib


ML_DIR = Path(__file__).resolve().parent
MODEL_PATH = ML_DIR / "model.pkl"
VECTORIZER_PATH = ML_DIR / "vectorizer.pkl"

# Load saved model and vectorizer
if not MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
    raise FileNotFoundError(
        "Text model files are missing. Expected model.pkl and vectorizer.pkl "
        f"inside {ML_DIR}."
    )

model = joblib.load(MODEL_PATH)
vectorizer = joblib.load(VECTORIZER_PATH)


def normalize_category(category):
    normalized = str(category).strip().lower()
    aliases = {
        "water supply": "water",
    }
    return aliases.get(normalized, normalized)


def predict_category_with_confidence(text):
    if not text or not text.strip():
        raise ValueError("Complaint text cannot be empty")

    # Convert text into TF-IDF vector
    text_vector = vectorizer.transform([text.strip()])

    prediction = normalize_category(model.predict(text_vector)[0])

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(text_vector)[0]
        confidence = float(max(probabilities))
    else:
        confidence = 1.0

    return {
        "category": prediction,
        "confidence": confidence,
    }


def predict_category(text):
    prediction = predict_category_with_confidence(text)
    return prediction["category"]


# Test prediction
