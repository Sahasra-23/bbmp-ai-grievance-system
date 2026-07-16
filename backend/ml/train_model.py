from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
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

    if df.empty:
        raise ValueError("No rows remain after filtering to the four categories")

    print("Text samples per class:")
    print(df["category"].value_counts().reindex(CLASS_NAMES))

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["category"],
        test_size=0.2,
        random_state=42,
        stratify=df["category"],
    )

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )
    X_train_vectors = vectorizer.fit_transform(X_train)
    X_test_vectors = vectorizer.transform(X_test)

    model = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X_train_vectors, y_train)

    predictions = model.predict(X_test_vectors)
    accuracy = accuracy_score(y_test, predictions)

    print(f"Text training samples: {len(X_train)}")
    print(f"Text validation samples: {len(X_test)}")
    print(f"Text validation accuracy: {accuracy:.4f}")
    print(
        classification_report(
            y_test,
            predictions,
            labels=CLASS_NAMES,
            zero_division=0,
        )
    )

    joblib.dump(model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    print(f"Saved text model to: {MODEL_PATH}")
    print(f"Saved vectorizer to: {VECTORIZER_PATH}")


if __name__ == "__main__":
    main()
