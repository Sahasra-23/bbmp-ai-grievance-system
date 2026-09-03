import argparse
import json
import logging



from ml.image_predict import predict_image_category
from ml.predict import predict_category_with_confidence


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def choose_final_prediction(text_prediction, image_prediction):
    text_category = text_prediction["category"]
    text_confidence = float(text_prediction["confidence"])
    image_category = image_prediction["category"]
    image_confidence = float(image_prediction["confidence"])

    if text_category == image_category:
        combined_confidence = (
            text_confidence + image_confidence
        ) / 2
        return {
            "category": text_category,
            "confidence": combined_confidence,
            "source": "text+image agreement",
        }

    if image_confidence > text_confidence:
        return {
            "category": image_category,
            "confidence": image_confidence,
            "source": "image confidence",
        }

    return {
        "category": text_category,
        "confidence": text_confidence,
        "source": "text confidence",
    }


def log_prediction_summary(
    text_prediction,
    image_prediction,
    final_prediction,
):
    logger.info("Text prediction: %s", text_prediction["category"])
    logger.info(
        "Text confidence: %.4f",
        text_prediction["confidence"],
    )
    logger.info("Image prediction: %s", image_prediction["category"])
    logger.info(
        "Image confidence: %.4f",
        image_prediction["confidence"],
    )
    logger.info("Final category: %s", final_prediction["category"])


def predict_hybrid_category(text, image_path):
    if not image_path:
        raise ValueError(
            "An image path is required for multimodal prediction."
        )

    print("STEP 1 - Starting text prediction")
    text_prediction = predict_category_with_confidence(text)
    print("STEP 2 - Text prediction:", text_prediction)

    print("STEP 3 - Starting image prediction")
    image_prediction = predict_image_category(image_path)
    print("STEP 4 - Image prediction:", image_prediction)

    print("STEP 5 - Choosing final prediction")
    final_prediction = choose_final_prediction(
        text_prediction,
        image_prediction,
    )
    log_prediction_summary(
        text_prediction,
        image_prediction,
        final_prediction,
    )

    return {
        "final": final_prediction,
        "text": text_prediction,
        "image": image_prediction,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Predict a grievance category using text and image."
    )
    parser.add_argument("text", help="Complaint description")
    parser.add_argument("image_path", help="Path to complaint image")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s",
    )
    result = predict_hybrid_category(args.text, args.image_path)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
