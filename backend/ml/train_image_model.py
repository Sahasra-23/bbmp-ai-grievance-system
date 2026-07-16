import json
import sys
from pathlib import Path


ML_DIR = Path(__file__).resolve().parent
DATASET_DIR = ML_DIR / "dataset"
MODEL_PATH = ML_DIR / "image_model.keras"
ARTIFACTS_DIR = ML_DIR / "artifacts"
CLASS_NAMES_PATH = ML_DIR / "image_class_names.json"

CLASS_NAMES = ["electricity", "roads", "sanitation", "water"]
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif"}
IMAGE_SIZE = (224, 224)
BATCH_SIZE = 16
VALIDATION_SPLIT = 0.2
SEED = 42
INITIAL_EPOCHS = 10
FINE_TUNE_EPOCHS = 5


def import_training_dependencies():
    if sys.version_info >= (3, 14):
        raise RuntimeError(
            "TensorFlow does not provide an official Windows wheel for Python "
            f"{sys.version_info.major}.{sys.version_info.minor}. Create an ML "
            "environment with Python 3.10-3.13, then install requirements-ml.txt."
        )

    try:
        import numpy as np
        import pandas as pd
        import tensorflow as tf
        from sklearn.metrics import classification_report, confusion_matrix
    except ImportError as exc:
        raise RuntimeError(
            "Missing ML dependencies. Activate a Python 3.10-3.13 virtual "
            "environment and run: pip install -r requirements-ml.txt"
        ) from exc

    return tf, np, pd, classification_report, confusion_matrix


def count_dataset_images():
    if not DATASET_DIR.exists():
        raise FileNotFoundError(
            f"Dataset folder not found: {DATASET_DIR}. Expected one folder per "
            f"class: {', '.join(CLASS_NAMES)}."
        )

    actual_directories = sorted(
        path.name
        for path in DATASET_DIR.iterdir()
        if path.is_dir()
    )
    missing_classes = sorted(set(CLASS_NAMES) - set(actual_directories))
    unexpected_classes = sorted(set(actual_directories) - set(CLASS_NAMES))

    if missing_classes:
        raise ValueError(
            "Missing dataset class folders: " + ", ".join(missing_classes)
        )

    if unexpected_classes:
        raise ValueError(
            "Unexpected dataset class folders: "
            + ", ".join(unexpected_classes)
            + ". Keep only: "
            + ", ".join(CLASS_NAMES)
        )

    counts = {}
    for class_name in CLASS_NAMES:
        class_dir = DATASET_DIR / class_name
        counts[class_name] = sum(
            1
            for path in class_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        )

    total_images = sum(counts.values())
    if total_images == 0:
        raise ValueError(
            f"No supported images found in {DATASET_DIR}. Supported extensions: "
            + ", ".join(sorted(SUPPORTED_EXTENSIONS))
        )

    empty_classes = [
        class_name
        for class_name, count in counts.items()
        if count == 0
    ]
    if empty_classes:
        raise ValueError(
            "No images found for class folders: " + ", ".join(empty_classes)
        )

    return counts


def print_dataset_summary(counts):
    print(f"Dataset directory: {DATASET_DIR}")
    print(f"Class names: {CLASS_NAMES}")
    for class_name in CLASS_NAMES:
        print(f"Images in {class_name}: {counts[class_name]}")
    print(f"Total images found: {sum(counts.values())}")


def build_datasets(tf):
    common_options = {
        "directory": DATASET_DIR,
        "validation_split": VALIDATION_SPLIT,
        "seed": SEED,
        "image_size": IMAGE_SIZE,
        "batch_size": BATCH_SIZE,
        "class_names": CLASS_NAMES,
        "label_mode": "int",
    }

    train_dataset = tf.keras.utils.image_dataset_from_directory(
        subset="training",
        shuffle=True,
        **common_options,
    )
    validation_dataset = tf.keras.utils.image_dataset_from_directory(
        subset="validation",
        shuffle=True,
        **common_options,
    )

    if list(train_dataset.class_names) != CLASS_NAMES:
        raise RuntimeError(
            f"TensorFlow loaded classes {train_dataset.class_names}, expected "
            f"{CLASS_NAMES}."
        )

    autotune = tf.data.AUTOTUNE
    train_dataset = train_dataset.prefetch(autotune)
    # Cache the shuffled validation order so labels and predictions stay aligned.
    validation_dataset = validation_dataset.cache().prefetch(autotune)
    return train_dataset, validation_dataset


def count_split_labels(tf, dataset):
    counts = tf.zeros(len(CLASS_NAMES), dtype=tf.int32)
    for _, labels in dataset:
        counts += tf.math.bincount(
            labels,
            minlength=len(CLASS_NAMES),
            maxlength=len(CLASS_NAMES),
        )
    return {
        class_name: int(counts[index].numpy())
        for index, class_name in enumerate(CLASS_NAMES)
    }


def build_model(tf):
    layers = tf.keras.layers
    augmentation = tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal"),
            layers.RandomRotation(0.08),
            layers.RandomZoom(0.12),
            layers.RandomContrast(0.1),
        ],
        name="data_augmentation",
    )

    base_model = tf.keras.applications.MobileNetV2(
        input_shape=IMAGE_SIZE + (3,),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=IMAGE_SIZE + (3,), name="image")
    x = augmentation(inputs)
    # image_dataset_from_directory returns pixels in the 0-255 range.
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(
        len(CLASS_NAMES),
        activation="softmax",
        name="category",
    )(x)

    model = tf.keras.Model(inputs, outputs, name="namma_fix_image_classifier")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model, base_model


def create_callbacks(
    tf,
    initial_value_threshold=None,
    append_log=False,
):
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    return [
        tf.keras.callbacks.ModelCheckpoint(
            MODEL_PATH,
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            initial_value_threshold=initial_value_threshold,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            mode="max",
            patience=4,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.3,
            patience=2,
            min_lr=1e-7,
            verbose=1,
        ),
        tf.keras.callbacks.CSVLogger(
            ARTIFACTS_DIR / "training_log.csv",
            append=append_log,
        ),
    ]


def fine_tune_model(
    tf,
    model,
    base_model,
    train_dataset,
    validation_dataset,
    initial_best_accuracy,
):
    base_model.trainable = True

    fine_tune_from = max(0, len(base_model.layers) - 30)
    for layer in base_model.layers[:fine_tune_from]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model.fit(
        train_dataset,
        validation_data=validation_dataset,
        epochs=FINE_TUNE_EPOCHS,
        callbacks=create_callbacks(
            tf,
            initial_value_threshold=initial_best_accuracy,
            append_log=True,
        ),
    )


def evaluate_model(
    tf,
    np,
    pd,
    classification_report,
    confusion_matrix,
    validation_dataset,
):
    model = tf.keras.models.load_model(MODEL_PATH)
    validation_loss, validation_accuracy = model.evaluate(
        validation_dataset,
        verbose=0,
    )

    true_labels = np.concatenate(
        [labels.numpy() for _, labels in validation_dataset],
        axis=0,
    )
    probabilities = model.predict(validation_dataset, verbose=1)
    predicted_labels = np.argmax(probabilities, axis=1)

    matrix = confusion_matrix(
        true_labels,
        predicted_labels,
        labels=range(len(CLASS_NAMES)),
    )
    report_text = classification_report(
        true_labels,
        predicted_labels,
        labels=range(len(CLASS_NAMES)),
        target_names=CLASS_NAMES,
        digits=4,
        zero_division=0,
    )
    report_dict = classification_report(
        true_labels,
        predicted_labels,
        labels=range(len(CLASS_NAMES)),
        target_names=CLASS_NAMES,
        output_dict=True,
        zero_division=0,
    )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(
        matrix,
        index=CLASS_NAMES,
        columns=CLASS_NAMES,
    ).to_csv(ARTIFACTS_DIR / "confusion_matrix.csv")
    pd.DataFrame(report_dict).transpose().to_csv(
        ARTIFACTS_DIR / "classification_report.csv"
    )
    (ARTIFACTS_DIR / "classification_report.txt").write_text(
        report_text,
        encoding="utf-8",
    )

    try:
        import matplotlib.pyplot as plt

        figure, axis = plt.subplots(figsize=(8, 6))
        image = axis.imshow(matrix, cmap="Blues")
        figure.colorbar(image, ax=axis)
        axis.set(
            xticks=range(len(CLASS_NAMES)),
            yticks=range(len(CLASS_NAMES)),
            xticklabels=CLASS_NAMES,
            yticklabels=CLASS_NAMES,
            xlabel="Predicted category",
            ylabel="Actual category",
            title="Image classifier confusion matrix",
        )
        plt.setp(axis.get_xticklabels(), rotation=35, ha="right")
        for row in range(matrix.shape[0]):
            for column in range(matrix.shape[1]):
                axis.text(
                    column,
                    row,
                    matrix[row, column],
                    ha="center",
                    va="center",
                )
        figure.tight_layout()
        figure.savefig(
            ARTIFACTS_DIR / "confusion_matrix.png",
            dpi=160,
        )
        plt.close(figure)
    except ImportError:
        print(
            "matplotlib is not installed; confusion_matrix.csv was generated "
            "but no PNG was created."
        )

    print("\nConfusion matrix:")
    print(matrix)
    print("\nClassification report:")
    print(report_text)
    print(f"Validation loss: {validation_loss:.4f}")
    print(f"Validation accuracy: {validation_accuracy:.4f}")
    return validation_accuracy


def main():
    counts = count_dataset_images()
    print_dataset_summary(counts)

    tf, np, pd, classification_report, confusion_matrix = (
        import_training_dependencies()
    )
    print(f"TensorFlow version: {tf.__version__}")

    train_dataset, validation_dataset = build_datasets(tf)
    print(
        "Training split counts: "
        f"{count_split_labels(tf, train_dataset)}"
    )
    print(
        "Validation split counts: "
        f"{count_split_labels(tf, validation_dataset)}"
    )
    model, base_model = build_model(tf)

    print("\nTraining MobileNetV2 classification head...")
    initial_history = model.fit(
        train_dataset,
        validation_data=validation_dataset,
        epochs=INITIAL_EPOCHS,
        callbacks=create_callbacks(tf),
    )
    initial_best_accuracy = max(
        initial_history.history["val_accuracy"]
    )

    print("\nFine-tuning the last 30 MobileNetV2 layers...")
    fine_tune_history = fine_tune_model(
        tf,
        model,
        base_model,
        train_dataset,
        validation_dataset,
        initial_best_accuracy,
    )

    final_training_accuracy = fine_tune_history.history["accuracy"][-1]
    final_validation_accuracy = fine_tune_history.history["val_accuracy"][-1]
    best_validation_accuracy = max(
        initial_history.history["val_accuracy"]
        + fine_tune_history.history["val_accuracy"]
    )

    CLASS_NAMES_PATH.write_text(
        json.dumps(CLASS_NAMES, indent=2),
        encoding="utf-8",
    )

    print(f"\nFinal training accuracy: {final_training_accuracy:.4f}")
    print(f"Final validation accuracy: {final_validation_accuracy:.4f}")
    print(f"Best validation accuracy: {best_validation_accuracy:.4f}")
    print(f"Saved best model to: {MODEL_PATH}")
    print(f"Saved class names to: {CLASS_NAMES_PATH}")

    validation_accuracy = evaluate_model(
        tf,
        np,
        pd,
        classification_report,
        confusion_matrix,
        validation_dataset,
    )
    print(f"Evaluation artifacts saved to: {ARTIFACTS_DIR}")

    if validation_accuracy < 0.75:
        print(
            "Warning: validation accuracy is below the 75% target. Review "
            "misclassified images, class quality, and augmentation settings."
        )


if __name__ == "__main__":
    main()
