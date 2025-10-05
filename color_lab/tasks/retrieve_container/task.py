from eos.tasks.base_task import BaseTask


class RetrieveContainer(BaseTask):
    async def _execute(
        self,
        devices: BaseTask.DevicesType,
        parameters: BaseTask.ParametersType,
        resources: BaseTask.ResourcesType,
    ) -> BaseTask.OutputType:
        robot_arm = devices["robot_arm"]
        color_mixer = devices["color_mixer"]

        target_location = color_mixer.meta["location"]

        resources["beaker"] = robot_arm.move_container(resources["beaker"], target_location)

        return None, resources, None
