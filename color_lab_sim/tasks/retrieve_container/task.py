from eos import task

from color_lab_sim.devices.color_station.device import ColorStation
from color_lab_sim.devices.robot_arm.device import RobotArm
from color_lab_sim.resources import Beaker, BeakerOutputs


@task("Retrieve Container")
async def retrieve_container(robot_arm: RobotArm, color_station: ColorStation, beaker: Beaker) -> BeakerOutputs:
    """Retrieve a container from a container storage unit using a robotic arm."""
    return BeakerOutputs(beaker=robot_arm.move_container(beaker, color_station.meta["location"]))
