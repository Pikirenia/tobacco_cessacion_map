"""Exercise drift detection and regeneration in a disposable copy, not the source."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("check_data", root / "scripts/check-data.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    module.ROOT = Path(directory)
    shutil.copytree(root / "data", module.ROOT / "data")
    path = module.ROOT / "data/map-data.js"
    original = json.loads(path.read_text().strip()[13:-1])
    modified = json.loads(json.dumps(original))
    modified[next(iter(modified))]["r"] = "AAAA"
    path.write_text("const DATA = " + json.dumps(modified) + ";\n")
    try:
        module.check()
        raise AssertionError("Map drift was not detected")
    except ValueError as error:
        assert "map-data.js" in str(error)
    module.check(write=True)
    assert json.loads(path.read_text().strip()[13:-1]) == original
    csv_path = module.ROOT / "data/by_country.csv"
    csv_path.write_text(csv_path.read_text().replace("UNCERTAIN", "AVAILABLE", 1))
    try:
        module.check()
        raise AssertionError("CSV drift was not detected")
    except ValueError as error:
        assert "by_country.csv" in str(error)
    module.check(write=True)
    module.check()
print("PASS: map/CSV drift detection and regeneration preserve all scientific fields and geography.")
