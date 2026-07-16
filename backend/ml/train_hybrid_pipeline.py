from pathlib import Path

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report

from ml.hybrid_predict import predict_hybrid_category


ML_DIR = Path(__file__).resolve().parent
CSV_PATH = ML_DIR / "dataset" / "complaints_multimodal.csv"
CLASS_NAMES = ["electricity", "roads", "sanitation", "water"]


def resolve_image_path(image_path):
    path = Path(image_path)
    if path.is_absolute():
        return path
    return ML_DIR / "dataset" / path


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Hybrid evaluation CSV not found: {CSV_PATH}. Create it with "
            "columns image_path,text,category. image_path may be relative to "
            "backend/ml/dataset."
        )

    df = pd.read_csv(CSV_PATH)
    required_columns = {"image_path", "text", "category"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(
            "CSV is missing columns: " + ", ".join(sorted(missing_columns))
        )

    df["category"] = (
        df["category"]
        .astype(str)
        .str.strip()
        .str.lower()
        .replace({"water supply": "water"})
    )
    invalid_categories = sorted(
        set(df["category"]) - set(CLASS_NAMES)
    )
    if invalid_categories:
        raise ValueError(
            "CSV contains unsupported categories: "
            + ", ".join(invalid_categories)
        )

    predictions = []
    labels = []

    for row in df.itertuples(index=False):
        image_path = resolve_image_path(row.image_path)
        if not image_path.exists():
            raise FileNotFoundError(
                f"Hybrid evaluation image not found: {image_path}"
            )

        result = predict_hybrid_category(row.text, image_path)
        predictions.append(result["final"]["category"])
        labels.append(row.category)

    accuracy = accuracy_score(labels, predictions)
    print(f"Hybrid samples evaluated: {len(labels)}")
    print(f"Hybrid accuracy: {accuracy:.4f}")
    print(
        classification_report(
            labels,
            predictions,
            labels=CLASS_NAMES,
            zero_division=0,
        )
    )

    if accuracy < 0.75:
        print(
            "Warning: hybrid accuracy is below 75%. Review low-confidence and "
            "misclassified examples, then improve the text/image datasets."
        )


if __name__ == "__main__":
    main()
