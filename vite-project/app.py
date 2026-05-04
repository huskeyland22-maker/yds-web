"""프로젝트 루트의 server.py 와 동일 API (vite 폴더에서 실행 시)."""
import importlib.util
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("root_server", _ROOT / "server.py")
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)
app = _mod.app

if __name__ == "__main__":
    _mod.app.run(host="0.0.0.0", port=5000)
