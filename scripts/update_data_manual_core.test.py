import ast
from pathlib import Path


def load_apply_manual_core():
    path = Path(__file__).resolve().parents[1] / "update_data.py"
    tree = ast.parse(path.read_text(encoding="utf-8-sig"))
    kept = []
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(target, "id", None) == "MANUAL_CORE_KEYS" for target in node.targets):
            kept.append(node)
        elif isinstance(node, ast.FunctionDef) and node.name == "apply_manual_core":
            kept.append(node)
    module = ast.Module(body=kept, type_ignores=[])
    namespace = {"Any": object}
    exec(compile(module, str(path), "exec"), namespace)
    return namespace["apply_manual_core"]


def test_apply_manual_core_keeps_existing_inputs():
    apply_manual_core = load_apply_manual_core()
    existing = {
        "vix": {"value": 28.2, "delta": 0.4},
        "fearGreed": {"value": 20, "delta": -1},
        "putCall": {"value": 0.8, "delta": 0},
        "bofa": 6.6,
    }
    payload = {
        "vix": {"value": 99},
        "fearGreed": {"value": 1},
        "putCall": {"value": 1.4},
        "vxn": {"value": 33},
        "highYield": {"value": 3.2},
        "bofa": None,
    }
    out = apply_manual_core(existing, payload)
    assert out["vix"] == existing["vix"]
    assert out["fearGreed"] == existing["fearGreed"]
    assert out["putCall"] == existing["putCall"]
    assert out["vxn"]["value"] == 33
    assert out["highYield"]["value"] == 3.2
    assert out["bofa"] is None


if __name__ == "__main__":
    test_apply_manual_core_keeps_existing_inputs()
    print("ok")
