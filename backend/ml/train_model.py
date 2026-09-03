import json
import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC, SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
from sklearn.model_selection import train_test_split

ML_DIR = Path(__file__).resolve().parent
CSV_PATH = ML_DIR / "complaints.csv"
MODEL_PATH = ML_DIR / "model.pkl"
VECTORIZER_PATH = ML_DIR / "vectorizer.pkl"

CATEGORY_MAPPING = {
    "electricity": "electricity",
    "roads": "roads",
    "sanitation": "sanitation",
    "water supply": "water",
    "water": "water",
    "street light": "electricity",
}
CLASS_NAMES = ["electricity", "roads", "sanitation", "water"]

def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Text dataset not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)
    if not {"text", "category"}.issubset(df.columns):
        raise ValueError("complaints.csv must contain text and category columns")

    df["category"] = (
        df["category"]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(CATEGORY_MAPPING)
    )
    df = df.dropna(subset=["text", "category"])

    print("=" * 80)
    print("DATASET ANALYSIS")
    print("=" * 80)
    print(f"Total dataset samples (filtered to 4 target classes): {len(df)}")
    print("\nSamples per category:")
    counts = df["category"].value_counts().reindex(CLASS_NAMES)
    for cat, count in counts.items():
        print(f"  - {cat:12s}: {count} samples")
    print("=" * 80)

    # Stratified Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["category"],
        test_size=0.2,
        random_state=42,
        stratify=df["category"],
    )

    print(f"\nTrain set size: {len(X_train)} samples")
    print(f"Test set size:  {len(X_test)} samples\n")

    # TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # Define candidate models
    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42,
        ),
        "Linear SVM": CalibratedClassifierCV(
            estimator=LinearSVC(class_weight="balanced", random_state=42),
            method="sigmoid"
        ),
        "Multinomial Naive Bayes": MultinomialNB(alpha=0.5),
    }

    results = {}
    fitted_models = {}

    print("=" * 80)
    print("MODEL COMPARISON ON HELD-OUT TEST SET")
    print("=" * 80)

    for name, model in models.items():
        model.fit(X_train_vec, y_train)
        y_pred = model.predict(X_test_vec)

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average="macro", zero_division=0)
        rec = recall_score(y_test, y_pred, average="macro", zero_division=0)
        f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)

        results[name] = {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "report": classification_report(y_test, y_pred, labels=CLASS_NAMES, zero_division=0)
        }
        fitted_models[name] = model

        print(f"\nModel: {name}")
        print(f"  Accuracy:  {acc:.4f}")
        print(f"  Precision: {prec:.4f}")
        print(f"  Recall:    {rec:.4f}")
        print(f"  F1-Score:  {f1:.4f}")
        print("\nClassification Report:")
        print(results[name]["report"])
        print("-" * 50)

    # Select best model based on F1-score & Accuracy on held-out test set
    best_model_name = max(results.keys(), key=lambda k: (results[k]["f1_score"], results[k]["accuracy"]))
    best_model = fitted_models[best_model_name]

    print("\n" + "=" * 80)
    print(f"WINNING MODEL SELECTED: {best_model_name}")
    print(f"  Test Accuracy: {results[best_model_name]['accuracy']:.4f}")
    print(f"  Test F1-Score: {results[best_model_name]['f1_score']:.4f}")
    print("=" * 80 + "\n")

    # Save winning model and vectorizer
    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    print(f"Saved winning model to: {MODEL_PATH}")
    print(f"Saved vectorizer to:    {VECTORIZER_PATH}\n")

    # Verify predict_category_with_confidence
    sys.path.insert(0, str(ML_DIR))
    from predict import predict_category_with_confidence, map_category_to_display

    print("=" * 80)
    print("UNSEEN TEST PREDICTIONS USING WINNING MODEL")
    print("=" * 80)

    unseen_complaints = [
        "The street light at 5th cross junction is totally pitch black and dangerous.",
        "Huge crater on 80 feet road near bus stop damaging vehicles.",
        "Garbage pile rotting near apartment gate and foul smell everywhere.",
        "No water coming out of taps since morning in block B.",
        "High voltage fluctuations flickering all bulbs and burnt my refrigerator.",
        "Drainage water overflowing near vegetable market causing health hazard."
    ]

    for complaint_text in unseen_complaints:
        pred_obj = predict_category_with_confidence(complaint_text)
        mapped_cat = map_category_to_display(pred_obj["category"])
        print(f"\nComplaint: \"{complaint_text}\"")
        print(f"  Internal Category: {pred_obj['category']}")
        print(f"  Mapped Category:   {mapped_cat}")
        print(f"  Confidence:        {pred_obj['confidence']:.4f} ({pred_obj['confidence']*100:.1f}%)")

if __name__ == "__main__":
    main()
