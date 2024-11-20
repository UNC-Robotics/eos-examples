from eos.tasks.base_task import BaseTask


class AnalyzeColor(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        color_analyzer = devices.get_all_by_type("color_analyzer")[0]

        containers["beaker"], rgb = color_analyzer.analyze(containers["beaker"])

        output_parameters = {
            "red": rgb[0],
            "green": rgb[1],
            "blue": rgb[2],
        }

        return output_parameters, containers, None
