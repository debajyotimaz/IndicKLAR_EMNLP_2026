# Animated Figure 9: rank of the correct answer token across Llama-3.1-8B-Instruct layers,
# Baseline vs TinT-CM (values recovered from the paper's vector figure).
import json, os, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
d = json.load(open("fig9_data.json"))
L = np.array(d["layers"], float); B = np.array(d["baseline_target_correct"]); T = np.array(d["tint_cm"])
GREY, BLUE, INK, INK2, GRID = "#8a8984", "#2a78d6", "#16161a", "#4d4c48", "#ebe9e4"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 13})
os.makedirs("frames", exist_ok=True)
steps = np.linspace(0, 32, 97)               # 3 sub-steps per layer for a smooth draw
hold = 30
for i, t in enumerate(list(steps) + [32] * hold):
    fig, ax = plt.subplots(figsize=(9, 4.8), dpi=100)
    fig.patch.set_facecolor("white")
    ax.set_xlim(-0.5, 32.6); ax.set_ylim(-0.2, 5.0)
    for s in ["top", "right"]: ax.spines[s].set_visible(False)
    for s in ["left", "bottom"]: ax.spines[s].set_color("#c9c7c1")
    ax.tick_params(colors=INK2, length=0)
    ax.grid(axis="y", color=GRID, lw=1); ax.set_axisbelow(True)
    ax.set_xticks([0, 8, 16, 24, 32])
    ax.set_xlabel("Layer of Llama-3.1-8B-Instruct", color=INK2)
    ax.set_ylabel("log$_{10}$(rank + 1) of correct answer", color=INK2)
    ax.text(0, 4.93, "lower = correct answer ranked higher", color=INK2, fontsize=11, va="top")
    m = L <= t
    xs = np.append(L[m], t); fb = np.interp(xs, L, B); ft = np.interp(xs, L, T)
    if t > 16.2:
        ax.axvspan(16.2, min(t, 32), color=BLUE, alpha=0.06, lw=0)
        ax.axvline(16.2, color=BLUE, lw=1, ls=(0, (3, 3)), alpha=.6)
        ax.text(16.6, 0.15, "paths split ≈ layer 16", color=BLUE, fontsize=11)
    ax.plot(xs, fb, color=GREY, lw=2.5, solid_capstyle="round")
    ax.plot(xs, ft, color=BLUE, lw=3, solid_capstyle="round")
    ax.scatter([xs[-1]] * 2, [fb[-1], ft[-1]], s=[55, 70], c=[GREY, BLUE], edgecolors="white", linewidths=2, zorder=5, clip_on=False)
    ax.annotate(f"Baseline  {fb[-1]:.1f}", (xs[-1], fb[-1]), xytext=(9, 0 if fb[-1] > ft[-1] else -2), textcoords="offset points", annotation_clip=False,
                color=GREY, fontsize=12, fontweight="bold", va="center")
    ax.annotate(f"TinT-CM  {ft[-1]:.1f}", (xs[-1], ft[-1]), xytext=(9, 0), textcoords="offset points", annotation_clip=False,
                color=BLUE, fontsize=12, fontweight="bold", va="center")
    fig.subplots_adjust(left=0.09, right=0.80, top=0.95, bottom=0.14)
    fig.savefig(f"frames/f{i:03d}.png", facecolor="white"); plt.close(fig)
print("frames", i + 1)
