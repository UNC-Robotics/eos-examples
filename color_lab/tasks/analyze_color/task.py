from eos.tasks.base_task import BaseTask


class AnalyzeColor(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        color_analyzer = devices["color_analyzer"]

        resources["beaker"], rgb = color_analyzer.analyze(resources["beaker"])

        output_parameters = {
            "red": rgb[0],
            "green": rgb[1],
            "blue": rgb[2],
        }

        return output_parameters, resources, None
