from eos.tasks.base_task import BaseTask


class StoreContainerTask(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        robot_arm = devices.get_all_by_type("robot_arm")[0]
        storage_location = parameters["storage_location"]

        containers["beaker"] = robot_arm.move_container(containers["beaker"], storage_location)

        return None, containers, None
