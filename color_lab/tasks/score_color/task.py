import math

from eos.tasks.base_task import BaseTask


class ScoreColor(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        red = parameters["red"]
        green = parameters["green"]
        blue = parameters["blue"]
        total_color_volume = parameters["total_color_volume"]
        max_total_color_volume = parameters["max_total_color_volume"]
        target_color = parameters["target_color"]

        color_distance = math.sqrt(
            (red - target_color[0]) ** 2 + (green - target_color[1]) ** 2 + (blue - target_color[2]) ** 2
        )
        color_distance_normalized = color_distance / math.sqrt(3 * (255**2))

        normalized_volume = min(total_color_volume / max_total_color_volume, 1.0)

        color_weight = 0.8
        total_color_volume_weight = 0.2
        loss = (color_weight * color_distance_normalized) + (total_color_volume_weight * normalized_volume)

        output_parameters = {"loss": float(loss), "color_distance": float(color_distance)}
        return output_parameters, None, None
