from eos.tasks.base_task import BaseTask


class CleanContainer(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        cleaning_station = devices["cleaning_station"]
        duration = parameters["duration"]

        resources["beaker"] = cleaning_station.clean(resources["beaker"], duration_sec=duration)

        return None, resources, None
