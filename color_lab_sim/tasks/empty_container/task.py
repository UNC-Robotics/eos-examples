from eos import Param, task

from color_lab_sim.devices.cleaning_station.device import CleaningStation
from color_lab_sim.devices.robot_arm.device import RobotArm
from color_lab_sim.resources import Beaker, BeakerOutputs


@task("Empty Container")
async def empty_container(
    robot_arm: RobotArm,
    cleaning_station: CleaningStation,
    beaker: Beaker,
    emptying_location: str = Param(desc="The location to empty the container at"),
) -> BeakerOutputs:
    """Move a container to a location and empty it."""
    beaker = robot_arm.empty_container(beaker, emptying_location)
    return BeakerOutputs(beaker=robot_arm.move_container(beaker, cleaning_station.meta["location"]))
