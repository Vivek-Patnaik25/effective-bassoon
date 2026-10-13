from types import SimpleNamespace

from gestures.hand import Debouncer, classify_landmarks


def _hand(extended):
    points = []
    for index in range(21):
        y = 0.2 if index in (8, 12, 16, 20) and extended else 0.8
        if index in (6, 10, 14, 18):
            y = 0.5
        points.append(SimpleNamespace(y=y))
    return points


def test_open_palm_and_fist():
    assert classify_landmarks(_hand(True)) == "open_palm"
    assert classify_landmarks(_hand(False)) == "fist"


def test_orientation_invariance_horizontal():
    def _hand_horizontal(extended):
        points = [SimpleNamespace(x=0.1, y=0.5, z=0.0)]
        for index in range(1, 21):
            if index in (8, 12, 16, 20):
                x = 0.85 if extended else 0.2
            elif index in (6, 10, 14, 18):
                x = 0.45
            else:
                x = 0.3
            points.append(SimpleNamespace(x=x, y=0.5, z=0.0))
        return points

    assert classify_landmarks(_hand_horizontal(True)) == "open_palm"
    assert classify_landmarks(_hand_horizontal(False)) == "fist"


def test_debouncer_fires_once_until_neutral():
    clock = {"now": 0.0}

    def fake_monotonic():
        return clock["now"]

    import gestures.hand as hand

    original = hand.time.monotonic
    hand.time.monotonic = fake_monotonic
    try:
        debouncer = Debouncer(hold_seconds=0.4)
        debouncer.update("open_palm")
        clock["now"] = 0.2
        debouncer.update("open_palm")
        assert debouncer.consume() == "none"
        clock["now"] = 0.5
        debouncer.update("open_palm")
        assert debouncer.consume() == "open_palm"
        clock["now"] = 1.2
        debouncer.update("open_palm")
        assert debouncer.consume() == "none"
        debouncer.update("none")
        clock["now"] = 1.3
        debouncer.update("fist")
        clock["now"] = 1.8
        debouncer.update("fist")
        assert debouncer.consume() == "fist"
    finally:
        hand.time.monotonic = original
