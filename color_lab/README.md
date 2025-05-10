# "Color Lab" EOS Package

Example EOS package for running a campaign of mixing RGB colors in a virtual lab with CMYK ingredients. Color mixing is performed with fluid simulation. The goal of the campaign is to discover the optimal parameters to mix the target color.

## Package Components

1. A virtual EOS laboratory called `color_lab`.
2. EOS virtual device implementations for a cleaning station, color mixer, color analyzer, and a robot arm. The devices communicate over a socket with "low-level" device drivers.
3. EOS task implementations for the experiment tasks.
4. A Jinja template of the color mixing experiment YAML under `experimens/template_experiment.yml`.
5. Three EOS experiment YAML files for running concurrent color mixing experiments with different target colors that use the color mixing experiment template.
6. The code for the WebGL-based fluid simulation under `fluid_simulation`.
7. The script `device_drivers.py` that starts the fluid simulation and simulated low-level device drivers.

> **_NOTE:_** These instructions assume that the package is being run on a local machine where EOS is installed.

## Installation

### Clone the repository inside the EOS user directory
```bash
cd eos/user
git clone https://github.com/UNC-Robotics/eos-examples eos_examples
```

### Install dependencies in the EOS venv
```bash
uv pip install -r user/eos_examples/color_lab/pyproject.toml
```

### Load the package in EOS
1. Edit the `config.yml` file to have the following for `user_dir`, `labs`, and `experiments`:
   ```yaml
   user_dir: ./user
   labs:
     - color_lab
   experiments:
     - color_mixing_1
     - color_mixing_2
     - color_mixing_3
   ```

## Sample Usage
1. `cd` into the `eos` directory. 
2. Run `python3 user/eos_examples/color_lab/device_drivers.py` to start the fluid simulation and simulated device drivers.
3. Start EOS.
4. Submit tasks, experiments, or campaigns through the REST API.

You can submit a request to run a campaign through the REST API with `curl` as follows:
```bash
curl -X POST http://localhost:8070/api/campaigns \
     -H "Content-Type: application/json" \
     -d '{
          "id": "color_mixing",
          "experiment_type": "color_mixing_1",
          "owner": "name",
          "priority": 0,
          "max_experiments": 10,
          "max_concurrent_experiments": 1,
          "optimize": true,
          "optimizer_ip": "127.0.0.1"
    }'
```

> **_NOTE:_** Do not minimize the fluid simulation browser windows while the campaign is running as the simulation may pause running.