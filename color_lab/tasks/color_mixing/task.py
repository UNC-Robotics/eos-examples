from eos.tasks.base_task import BaseTask


class MixColors(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        mixer = devices["color_mixer"]

        cyan_volume = parameters["cyan_volume"]
        cyan_strength = parameters["cyan_strength"]
        magenta_volume = parameters["magenta_volume"]
        magenta_strength = parameters["magenta_strength"]
        yellow_volume = parameters["yellow_volume"]
        yellow_strength = parameters["yellow_strength"]
        black_volume = parameters["black_volume"]
        black_strength = parameters["black_strength"]
        mixing_time = parameters["mixing_time"]
        mixing_speed = parameters["mixing_speed"]

        resources["beaker"] = mixer.mix(
            resources["beaker"],
            cyan_volume,
            cyan_strength,
            magenta_volume,
            magenta_strength,
            yellow_volume,
            yellow_strength,
            black_volume,
            black_strength,
            mixing_time,
            mixing_speed,
        )
        resources["beaker"].meta["clean"] = False

        return {"total_color_volume": cyan_volume + magenta_volume + yellow_volume + black_volume}, resources, None
