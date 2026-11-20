"""CI must not follow mutable GitHub Action tags that change builds silently."""
import re
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/ci.yml"


def test_all_remote_actions_are_commit_sha_pinned():
    content = WORKFLOW.read_text(encoding="utf-8")
    actions = re.findall(
        r"^\s*-?\s*uses:\s*([A-Za-z0-9_-]+/[A-Za-z0-9_-]+)@([^\s#]+)",
        content,
        flags=re.MULTILINE,
    )
    assert actions
    required = {
        "actions/checkout", "actions/setup-python", "actions/setup-node",
        "actions/setup-java", "actions/cache", "actions/upload-artifact",
        "android-actions/setup-android",
    }
    assert required <= {name for name, _ in actions}
    for name, revision in actions:
        assert re.fullmatch(r"[0-9a-f]{40}", revision), (name, revision)
    assert (
        "actions/setup-java@d1374f8ac74474200d16ef8ecee22c7ae7a51880"
        in content
    )
    assert "problem-matcher: true" in content
