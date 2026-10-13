"""Shared rules for the theatre prototype."""

CONF_MIN = 0.40
ENTER_FRAMES = 10
EXIT_FRAMES = 15
HOLD_SECONDS = 0.4
CAMERA_LOST_SECONDS = 2.0
TICK_SECONDS = 0.1

CLASSES = (
    "scalpel",
    "straight_dissection_clamp",
    "straight_mayo_scissor",
    "curved_mayo_scissor",
)

LABELS = {
    "scalpel": "Scalpel",
    "straight_dissection_clamp": "Straight dissection clamp",
    "straight_mayo_scissor": "Straight Mayo scissor",
    "curved_mayo_scissor": "Curved Mayo scissor",
}
