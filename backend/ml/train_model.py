
#X → inputs - of complains in details
#y → outputs - category of complaints
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import joblib


df = pd.read_csv("complaints.csv")

#training and testing data split
X = df["text"]
y = df["category"]
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,  # 80% training, 20% testing
    random_state=42
)
print("Training samples:", len(X_train))
print("Testing samples:", len(X_test))

#vectorization - converting text to numerical features
vectorizer = TfidfVectorizer()
X_train_vectors = vectorizer.fit_transform(X_train)
X_test_vectors = vectorizer.transform(X_test)
print(X_train_vectors.shape)

#logistic regression model
model = LogisticRegression()
model.fit(X_train_vectors, y_train)
print("Model trained successfully")

#prediction-Model predicts categories for unseen complaints.
predictions = model.predict(X_test_vectors)
print(predictions[:5])

#fav- accuracy - how well the model is performing on test data-how many predictions were correct
accuracy = accuracy_score(y_test, predictions)
print("Accuracy:", accuracy)


#new thing to me- saving the model-Saved model can later be loaded directly inside FastAPI.
joblib.dump(model, "model.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")
print("Model saved")