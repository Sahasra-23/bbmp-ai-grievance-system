import argparse
import json
import sys
from pathlib import Path
from threading import Lock


ML_DIR = Path(__file__).resolve().parent
MODEL_PATH = ML_DIR / "image_model.keras"
CLASS_NAMES_PATH = ML_DIR / "image_class_names.json"
DEFAULT_CLASS_NAMES = ["electricity", "roads", "sanitation", "water"]
IMAGE_SIZE = (224, 224)

_image_model = None
_model_lock = Lock()


class ImageModelNotFoundError(FileNotFoundError):
    pass


class ImagePredictionError(RuntimeError):
    pass


def get_class_names():
    if not CLASS_NAMES_PATH.exists():
        return DEFAULT_CLASS_NAMES

    try:
        class_names = json.loads(
            CLASS_NAMES_PATH.read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError) as exc:
        raise ImagePredictionError(
            f"Could not read class metadata from {CLASS_NAMES_PATH}: {exc}"
        ) from exc

    if class_names != DEFAULT_CLASS_NAMES:
        raise ImagePredictionError(
            f"Image model classes {class_names} do not match expected classes "
            f"{DEFAULT_CLASS_NAMES}."
        )

    return class_names


def import_tensorflow():
    if sys.version_info >= (3, 14):
        raise ImagePredictionError(
            "TensorFlow is not supported by this Windows Python 3.14 "
            "environment. Run image inference with Python 3.10-3.13."
        )

    try:
        import tensorflow as tf
        print("✅ TensorFlow imported successfully:", tf.__version__)
        return tf
    except Exception as exc:
        raise ImagePredictionError(f"TensorFlow is unavailable: {exc}") from exc


def load_image_model():
    global _image_model

    if _image_model is not None:
        return _image_model

    if not MODEL_PATH.exists():
        raise ImageModelNotFoundError(
            f"Trained image model not found at {MODEL_PATH}. Run "
            "`python ml/train_image_model.py` from the backend folder first."
        )

    with _model_lock:
        if _image_model is None:
            tf = import_tensorflow()
            try:
                _image_model = tf.keras.models.load_model(
                    MODEL_PATH,
                    compile=False,
                )
            except Exception as exc:
                raise ImagePredictionError(
                    f"Could not load image model from {MODEL_PATH}: {exc}"
                ) from exc

    return _image_model


def preprocess_image(image_path):
    tf = import_tensorflow()
    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:
        image = tf.keras.utils.load_img(
            image_path,
            target_size=IMAGE_SIZE,
            color_mode="rgb",
        )
        image_array = tf.keras.utils.img_to_array(image)
    except Exception as exc:
        raise ImagePredictionError(
            f"Could not read image {image_path}: {exc}"
        ) from exc

    # The saved model contains MobileNetV2 preprocess_input.
    return tf.expand_dims(image_array, axis=0)


def predict_image_category(image_path):
    model = load_image_model()
    tf = import_tensorflow()
    class_names = get_class_names()
    image_array = preprocess_image(image_path)

    probabilities = model.predict(image_array, verbose=0)[0]
    class_index = int(tf.argmax(probabilities).numpy())

    if class_index >= len(class_names):
        raise ImagePredictionError(
            "Image model output size does not match the saved class names."
        )

    return {
        "category": class_names[class_index],
        "confidence": float(probabilities[class_index]),
        "model_available": True,
        "probabilities": {
            class_name: float(probabilities[index])
            for index, class_name in enumerate(class_names)
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Predict a grievance category from one image."
    )
    parser.add_argument("image_path", help="Path to a complaint image")
    args = parser.parse_args()

    prediction = predict_image_category(args.image_path)
    print(json.dumps(prediction, indent=2))


if __name__ == "__main__":
    main()
