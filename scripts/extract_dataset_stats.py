import json
import numpy as np
from torch_geometric.datasets import Planetoid, Amazon

def extract_stats(dataset, name):
    data = dataset[0]
    num_nodes = data.num_nodes
    num_edges = data.num_edges
    num_features = data.num_node_features
    num_classes = dataset.num_classes
    density = (2 * num_edges) / (num_nodes * (num_nodes - 1))
    
    y = data.y.numpy()
    unique, counts = np.unique(y, return_counts=True)
    class_dist = {int(c): int(cnt) for c, cnt in zip(unique, counts)}
    
    major_class = int(unique[np.argmax(counts)])
    minor_class = int(unique[np.argmin(counts)])
    
    x = data.x.numpy()
    major_mask = y == major_class
    minor_mask = y == minor_class
    
    major_mean = x[major_mask].mean(axis=0)
    minor_mean = x[minor_mask].mean(axis=0)
    importance = np.abs(major_mean - minor_mean)
    top_10_features = np.argsort(-importance)[:10].tolist()
    
    return {
        "dataset": name,
        "num_nodes": num_nodes,
        "num_edges": num_edges,
        "num_features": num_features,
        "num_classes": num_classes,
        "density": round(float(density), 4),
        "major_class": major_class,
        "minor_class": minor_class,
        "class_distribution": class_dist,
        "top_10_features": top_10_features
    }

datasets_info = []

for dataset_name in ["Cora", "CiteSeer", "PubMed"]:
    dataset = Planetoid(root="./data", name=dataset_name)
    datasets_info.append(extract_stats(dataset, dataset_name))

for dataset_name in ["Computers", "Photo"]:
    dataset = Amazon(root="./data", name=dataset_name)
    datasets_info.append(extract_stats(dataset, f"Amazon {dataset_name}"))

with open("dataset_stats.json", "w") as f:
    json.dump(datasets_info, f, indent=2)

print("Dataset stats saved to dataset_stats.json")
