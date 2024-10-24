from eos.tasks.base_task import BaseTask


class EmptyContainerTask(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        containers: BaseTask.ContainersType,
    ) -> BaseTask.OutputType:
        robot_arm = devices.get_all_by_type("robot_arm")[0]

        emptying_location = parameters["emptying_location"]
        target_location = parameters["target_location"]

        containers["beaker"] = robot_arm.empty_container(containers["beaker"], emptying_location)
        containers["beaker"] = robot_arm.move_container(containers["beaker"], target_location)

        return None, containers, None
