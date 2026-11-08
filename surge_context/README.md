# 📁 Surge Context — Project Knowledge Base

**Project:** Real-Time Surgical Tool Tracking & Touchless Gesture Recognition System  
**Institution:** GIET University, Gunupur — B.Tech CSE (AI & ML) Major Project  
**Team:** 3 members (Student A: Perception, Student B: Gestures/Events, Student C: API/Frontend)

---

## Contents

| File | Description |
|---|---|
| [`task_split.md`](task_split.md) | Three-person task split — who builds what, module boundaries, shared message contract |
| [`user_stories.md`](user_stories.md) | 13 user stories (US-01 through US-13), acceptance criteria, priority tiers, module distribution |
| [`features.md`](features.md) | Detailed feature specifications — problem, solution, uniqueness, shared JSON schema, stack, repo layout |
| [`progress.md`](progress.md) | Running build log — what's working, what's been tested, and what improvements remain |
| [`TEAM_CONTRIBUTIONS.md`](TEAM_CONTRIBUTIONS.md) | Formal ownership matrix with per-student deliverables, quantitative benchmarks, and responsibility chart |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Step-by-step Vercel + Render deployment guide |

### Training Artifacts

| File | Description |
|---|---|
| `class_distribution.png` | Class distribution chart from training dataset |
| `inference_samples.png` | Sample inference outputs from trained model |
| `surge-reason.ipynb` | Model insights, clinical analytics & convergence visualizations notebook |
| `kaggle_train_yolov8.ipynb` | Local YOLOv8 training notebook |
| `surge-proj.ipynb` | Main Kaggle notebook (training + evaluation) — copy for reference |

### Additional Resources (in `kaggle_res/`)

The [`kaggle_res/`](../kaggle_res/) folder contains:
- `surge-proj.ipynb` — Primary Kaggle notebook (authoritative copy)
- `kaggle_train_yolov8_try1.ipynb` — Earlier training attempt
- `generate_graphs.py` — Script to extract training metrics and produce matplotlib plots
- `training_metrics_progression.png`, `per_class_map_comparison.png`, `confusion_matrix_surgical.png` — Generated visualizations
- `nb_results.txt` — Raw training output logs

---

## How to Read This

1. **Start with** `features.md` for the full system design and problem statement.
2. **Then** `user_stories.md` for formal requirements and acceptance criteria.
3. **Then** `task_split.md` for module ownership and the shared JSON contract.
4. **Then** `TEAM_CONTRIBUTIONS.md` for per-student deliverables and benchmarks.
5. **For deployment:** `DEPLOYMENT.md` covers Vercel + Render setup end-to-end.
6. **For current status:** `progress.md` has the honest build log of what works and what doesn't.
