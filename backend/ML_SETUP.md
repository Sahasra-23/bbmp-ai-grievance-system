# Namma Fix Multimodal ML

## Python requirement

TensorFlow on native Windows requires Python 3.10-3.13. The existing
`backend/venv` uses Python 3.14, so use a separate Python 3.13 environment
for training and for the FastAPI process that performs image inference.

```powershell
cd backend
py -3.13 -m venv .ml_venv313
.\.ml_venv313\Scripts\python.exe -m pip install --upgrade pip
.\.ml_venv313\Scripts\python.exe -m pip install -r requirements.txt
.\.ml_venv313\Scripts\python.exe -m pip install -r requirements-ml.txt
```

## Dataset layout

```text
ml/dataset/
|-- electricity/
|-- roads/
|-- sanitation/
`-- water/
```

The class folder names are fixed because the saved output order is:

```text
electricity, roads, sanitation, water
```

## Train the text model

```powershell
.\.ml_venv313\Scripts\python.exe ml\train_model.py
```

## Train the image model

```powershell
.\.ml_venv313\Scripts\python.exe ml\train_image_model.py
```

Outputs:

```text
ml/image_model.keras
ml/image_class_names.json
ml/artifacts/training_log.csv
ml/artifacts/confusion_matrix.csv
ml/artifacts/confusion_matrix.png
ml/artifacts/classification_report.csv
ml/artifacts/classification_report.txt
```

## Test one image

Replace the example filename with an image that exists in the dataset:

```powershell
.\.ml_venv313\Scripts\python.exe ml\image_predict.py "ml\dataset\roads\example.jpg"
```

## Test text and image together

```powershell
.\.ml_venv313\Scripts\python.exe ml\hybrid_predict.py "Large pothole on the main road" "ml\dataset\roads\example.jpg"
```

## Evaluate a mapped hybrid dataset

Create `ml/dataset/complaints_multimodal.csv`:

```csv
image_path,text,category
roads/example.jpg,Large pothole on the main road,roads
```

Then run:

```powershell
.\.ml_venv313\Scripts\python.exe ml\train_hybrid_pipeline.py
```

## Run FastAPI with image inference

The FastAPI process must use the same environment containing TensorFlow:

```powershell
.\.ml_venv313\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
