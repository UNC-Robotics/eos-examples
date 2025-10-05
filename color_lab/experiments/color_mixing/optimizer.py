from bofire.data_models.acquisition_functions.acquisition_function import qUCB
from bofire.data_models.enum import SamplingMethodEnum
from bofire.data_models.features.continuous import ContinuousOutput, ContinuousInput
from bofire.data_models.objectives.identity import MinimizeObjective

from eos.optimization.sequential_bayesian_optimizer import BayesianSequentialOptimizer
from eos.optimization.abstract_sequential_optimizer import AbstractSequentialOptimizer


def eos_create_campaign_optimizer() -> tuple[dict, type[AbstractSequentialOptimizer]]:
    constructor_args = {
        "inputs": [
            ContinuousInput(key="mix_colors.cyan_volume", bounds=(0, 25)),
            ContinuousInput(key="mix_colors.cyan_strength", bounds=(2, 100)),
            ContinuousInput(key="mix_colors.magenta_volume", bounds=(0, 25)),
            ContinuousInput(key="mix_colors.magenta_strength", bounds=(2, 100)),
            ContinuousInput(key="mix_colors.yellow_volume", bounds=(0, 25)),
            ContinuousInput(key="mix_colors.yellow_strength", bounds=(2, 100)),
            ContinuousInput(key="mix_colors.black_volume", bounds=(0, 25)),
            ContinuousInput(key="mix_colors.black_strength", bounds=(2, 100)),
            ContinuousInput(key="mix_colors.mixing_time", bounds=(1, 45)),
            ContinuousInput(key="mix_colors.mixing_speed", bounds=(100, 200)),
        ],
        "outputs": [
            ContinuousOutput(key="score_color.loss", objective=MinimizeObjective(w=1.0)),
        ],
        "constraints": [],
        "acquisition_function": qUCB(beta=1),
        "num_initial_samples": 25,
        "initial_sampling_method": SamplingMethodEnum.SOBOL,
    }

    return constructor_args, BayesianSequentialOptimizer
