from eos.tasks.base_task import BaseTask


class ColorMixingTask(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        mixer = devices.get_all_by_type("color_mixer")[0]

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

        containers["beaker"] = mixer.mix(
            containers["beaker"],
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

        return {"total_color_volume": cyan_volume + magenta_volume + yellow_volume + black_volume}, containers, None
