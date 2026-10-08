# Color Lab Simulation EOS Package

Example EOS package for running a campaign of mixing RGB colors in a virtual lab with CMYK ingredients. Color mixing is performed with fluid simulation. The goal of the campaign is to discover the optimal parameters to mix the target color.

This package supports EOS 0.30.x and Python 3.11 or newer.

From the EOS repository root, install the package into the EOS environment:

```bash
eos pkg install color_lab_sim
```

Select the package, lab, and protocol in `config.yml`:

```yaml
user_dir: ./user
packages:
  - color_lab_sim
labs:
  - color_lab_sim
protocols:
  - color_mixing_sim
```

Start the simulator in the same environment:

```bash
python user/eos-examples/color_lab_sim/device_drivers.py
```

This opens three browser simulation windows and starts the simulated device servers.
Keep the windows visible while running experiments. On Linux, the launcher detects
an installed NVIDIA driver and enables GPU offload automatically. It uses Edge when
Edge is your default browser, otherwise Chrome when available, with Edge as a fallback.
On Linux NVIDIA systems with an X11/XWayland display, it selects the browser's X11
backend because native Wayland may still select the integrated GPU. Other Linux
configurations use the browser's native display backend. macOS and Windows use the
system browser by default and support `--browser chrome` and `--browser edge` through
their native installation paths. NVIDIA offload flags apply only to Linux.
All platforms request high-performance WebGL rendering, with GPU selection ultimately
controlled by the browser and OS.

The explicitly launched Chrome or Edge browser uses a temporary profile so an existing browser on the integrated
GPU cannot take over. These dedicated windows close when the drivers stop.

To explicitly select Edge and NVIDIA offload, add `--browser edge --nvidia`.
Use `--no-nvidia` to keep the system's default GPU selection. The browser console
logs `Fluid simulation GPU:` with the renderer selected for each station.

Start EOS and submit a `color_mixing_sim` campaign with optimization enabled. Supply
`score_color.target_color` as an RGB list in the campaign's `global_parameters`,
for example `[128, 64, 192]`. The optimizer proposes the ten mixing parameters
and minimizes `score_color.loss`. Beacon uses Claude Opus for 80% of sampling
requests and Bayesian optimization for 20%. Authenticate Claude on the optimizer
worker using Claude Code credentials or `ANTHROPIC_API_KEY`.
