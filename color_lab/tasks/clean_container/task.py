from eos.tasks.base_task import BaseTask


class CleanContainerTask(BaseTask):
    def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        cleaning_station = devices.get_all_by_type("cleaning_station")[0]
        duration = parameters["duration"]

        containers["beaker"] = cleaning_station.clean(containers["beaker"], duration_sec=duration)

        return None, containers, None
