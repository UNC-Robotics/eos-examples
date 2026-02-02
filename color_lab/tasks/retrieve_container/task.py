from eos.tasks.base_task import BaseTask


class RetrieveContainer(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        robot_arm = devices["robot_arm"]
        color_station = devices["color_station"]

        target_location = color_station.meta["location"]

        resources["beaker"] = robot_arm.move_container(resources["beaker"], target_location)

        return None, resources, None
