"""
PyTorch Geometric dataset loader utility.
Provides a plug-and-play function to load Planetoid and Amazon datasets.
"""

from torch_geometric.datasets import Planetoid, Amazon


# Dataset name mapping for UI/API
DATASET_MAP = {
    "Cora": "cora",
    "CiteSeer": "citeseer",
    "PubMed": "pubmed",
    "Amazon Computers": "amazon_computers",
    "Amazon Photo": "amazon_photo",
}


def load_dataset(name: str):
    """
    Load a PyTorch Geometric dataset by name.
    
    Args:
        name: Dataset identifier. Supports:
            - "cora", "citeseer", "pubmed" (Planetoid)
            - "amazon_computers", "amazon_photo" (Amazon)
    
    Returns:
        tuple: (dataset, data) where data is dataset[0]
    
    Example:
        dataset, data = load_dataset("cora")
        print(data)  # Returns a Data object with graph structure
    """
    name_lower = name.lower()
    
    # Planetoid datasets
    if name_lower in ("cora", "citeseer", "pubmed"):
        dataset = Planetoid(root="data", name=name_lower.capitalize())
        return dataset, dataset[0]
    
    # Amazon datasets
    elif name_lower == "amazon_computers":
        dataset = Amazon(root="data", name="Computers")
        return dataset, dataset[0]
    
    elif name_lower == "amazon_photo":
        dataset = Amazon(root="data", name="Photo")
        return dataset, dataset[0]
    
    else:
        raise ValueError(
            f"Unknown dataset: {name}. "
            f"Supported: {', '.join(DATASET_MAP.values())}"
        )
