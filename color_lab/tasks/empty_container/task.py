from eos.tasks.base_task import BaseTask


class EmptyContainerTask(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        robot_arm = devices["robot_arm"]
        cleaning_station = devices["cleaning_station"]

        emptying_location = parameters["emptying_location"]
        target_location = cleaning_station.meta["location"]

        resources["beaker"] = robot_arm.empty_container(resources["beaker"], emptying_location)
        resources["beaker"] = robot_arm.move_container(resources["beaker"], target_location)

        return None, resources, None
