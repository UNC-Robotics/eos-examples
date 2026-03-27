import math

from eos.tasks.base_task import BaseTask


class ScoreColor(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        red = parameters["red"]
        green = parameters["green"]
        blue = parameters["blue"]
        target_color = parameters["target_color"]

        color_distance = math.sqrt(
            (red - target_color[0]) ** 2 + (green - target_color[1]) ** 2 + (blue - target_color[2]) ** 2
        )
        loss = color_distance / math.sqrt(3 * (255**2))

        output_parameters = {"loss": float(loss)}
        return output_parameters, None, None