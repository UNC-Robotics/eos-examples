from eos import Param, task

from color_lab_sim.devices.robot_arm.device import RobotArm
from color_lab_sim.resources import Beaker, BeakerOutputs


@task("Store Container")
async def store_container(
    robot_arm: RobotArm,
    beaker: Beaker,
    storage_location: str = Param(desc="The location to store the container at"),
) -> BeakerOutputs:
    """Store a container at a container storage."""
    beaker = robot_arm.move_container(beaker, storage_location)
    beaker.meta = {"volume": 0, "clean": True, "location": storage_location}
    return BeakerOutputs(beaker=beaker)
