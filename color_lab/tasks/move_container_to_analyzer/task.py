from eos.tasks.base_task import BaseTask


class MoveContainerToAnalyzer(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        robot_arm = devices["robot_arm"]
        color_analyzer = devices["color_analyzer"]

        target_location = color_analyzer.meta["location"]

        resources["beaker"] = robot_arm.move_container(resources["beaker"], target_location)

        return None, resources, None
