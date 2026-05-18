import joblib


# Load saved model and vectorizer
model = joblib.load("ml/model.pkl")

vectorizer = joblib.load("ml/vectorizer.pkl")


def predict_category(text):

    # Convert text into TF-IDF vector
    text_vector = vectorizer.transform([text])

    # Predict category
    prediction = model.predict(text_vector)

    # Return first prediction
    return prediction[0]


# Test prediction
