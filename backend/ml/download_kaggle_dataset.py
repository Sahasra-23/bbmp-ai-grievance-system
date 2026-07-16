import argparse
import zipfile
from pathlib import Path


def download_kaggle_dataset(dataset_slug, output_dir):
    try:
        import kaggle
    except ImportError as exc:
        raise RuntimeError(
            "Install kaggle first: pip install kaggle"
        ) from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    kaggle.api.authenticate()
    kaggle.api.dataset_download_files(
        dataset_slug,
        path=output_dir,
        unzip=False,
    )

    for zip_path in output_dir.glob("*.zip"):
        with zipfile.ZipFile(zip_path, "r") as zip_file:
            zip_file.extractall(output_dir)
        print(f"Extracted {zip_path}")

    print("Download complete.")
    print("Arrange images into:")
    print("dataset/sanitation")
    print("dataset/roads")
    print("dataset/water")
    print("dataset/electricity")
    print("Also create dataset/complaints_multimodal.csv with columns: image_path,text,category")


def main():
    parser = argparse.ArgumentParser(
        description="Download a Kaggle dataset for multimodal grievance classification."
    )
    parser.add_argument(
        "dataset_slug",
        help="Kaggle dataset slug, for example username/dataset-name",
    )
    parser.add_argument(
        "--output-dir",
        default="dataset",
        help="Where to download/extract the Kaggle dataset.",
    )
    args = parser.parse_args()

    download_kaggle_dataset(
        args.dataset_slug,
        Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
