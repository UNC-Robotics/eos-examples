# "Color Lab" EOS Package
Example EOS package for running a campaign of mixing RGB colors in a virtual lab with CMYK ingredients. Color mixing
is performed with fluid simulation. The goal of the campaign is to discover the optimal parameters to mix the target 
color, while trying to minimize how much of each color is used.

The package is made up of the following components:
1. A virtual EOS laboratory called `color_lab`.
2. EOS virtual device implementations for a cleaning station, color mixer, color analyzer, and a robot arm. The devices 
communicate over a socket with "low-level" device drivers.
3. EOS task implementations for the experiment tasks.
4. A Jinja template of the color mixing experiment YAML under `common/color_mixing_experiment.yml`.
5. Three EOS experiment YAML files for running concurrent color mixing experiments with different target colors that use
the color mixing experiment template.
6. The code for the WebGL-based fluid simulation under `fluid_simulation`.
7. The script `device_drivers.py` that starts the fluid simulation and simulated low-level device drivers.

> **_NOTE:_** These instructions assume that the package is being run on a local machine where EOS is installed.

## Installation
### Install dependencies in the EOS virtual environment:

```bash
pip3 install pymixbox websockets
```

### Load the package in EOS:
1. Place the `color_lab` directory in the `user` directory of your EOS installation.
2. Edit the `config.yml` file to have the following for `user_dir`, `labs`, and `experiments`:
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
2. Run `python3 user/color_lab/device_drivers.py` start the fluid simulation and simulated device drivers.
3. Follow the EOS README or instructions on the documentation website on how to run EOS.
4. Submit tasks, experiments, or campaigns through the REST API.

You can submit a request to run a campaign through the REST API with `curl` as follows:
```bash
curl -X POST http://localhost:8000/api/campaigns/submit \
     -H "Content-Type: application/json" \
     -d '{
  "campaign_id": "mix_colors",
  "experiment_type": "color_mixing_1",
  "max_experiments": 150,
  "max_concurrent_experiments": 1,
  "optimize": true,
  "optimizer_computer_ip": "127.0.0.1",
  "resume": false
}'
```

> **_NOTE:_** Be careful about minimizing the fluid simulation browser windows while a campaign is running as the simulation may 
> pause.
