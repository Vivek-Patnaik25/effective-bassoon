from perception.source import ReplaySource
from samples.generate import ensure_samples, tools_at


def test_replay_clip_matches_detections(tmp_path):
    video, labels = ensure_samples(tmp_path)
    source = ReplaySource(video, labels)
    frame, tools = source.read()
    assert frame is not None
    assert frame.shape[0] == 480
    assert tools == tools_at(0)
    seen_low = False
    for index in range(1, 60):
        _, tools = source.read()
        assert tools == tools_at(index)
        if any(tool["track_id"] == 99 and tool["loggable"] is False for tool in tools):
            seen_low = True
    source.close()
    assert seen_low
