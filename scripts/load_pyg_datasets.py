"""
PyTorch Geometric Dataset Information
Displays standard PyG datasets with metadata
"""

datasets = {
    "Planetoid": {
        "Cora": {"nodes": 2708, "edges": 10556, "features": 1433, "classes": 7},
        "CiteSeer": {"nodes": 3327, "edges": 9228, "features": 3703, "classes": 6},
        "PubMed": {"nodes": 19717, "edges": 88651, "features": 500, "classes": 3},
    },
    "Amazon": {
        "Computers": {"nodes": 13381, "edges": 491722, "features": 767, "classes": 10},
        "Photo": {"nodes": 7650, "edges": 238162, "features": 745, "classes": 8},
    },
}

print("PyTorch Geometric Datasets")
print("=" * 60)

for category, data in datasets.items():
    print(f"\n{category} Datasets:")
    for name, info in data.items():
        print(f"  {name:15} | nodes={info['nodes']:5} | edges={info['edges']:6} | features={info['features']:4} | classes={info['classes']}")

print("\n" + "=" * 60)
print("\nTo use these datasets with PyTorch Geometric:")
print("  from torch_geometric.datasets import Planetoid, Amazon")
print("  dataset = Planetoid(root='./data', name='Cora')")
print("  data = dataset[0]")
