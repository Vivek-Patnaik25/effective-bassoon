import os
import tempfile
from pathlib import Path

_root = Path(tempfile.mkdtemp(prefix="theatre-test-"))
os.environ["APP_DATA"] = str(_root)
os.environ["SAMPLES_DIR"] = str(_root / "samples")
os.environ["PIPELINE_AUTOSTART"] = "0"
os.environ["DISABLE_HAND_CAMERA"] = "1"
os.environ["JWT_SECRET"] = "test-secret"
