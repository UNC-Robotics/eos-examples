from typing import Any

from color_lab_sim.common.device_client import SimulationDevice
from color_lab_sim.resources import Beaker


class RobotArm(SimulationDevice, type="robot_arm"):
    """Robotic arm for moving containers."""

    class Config(SimulationDevice.Config):
        port: int = 5002

    async def _initialize(self, config: Config) -> None:
        await super()._initialize(config)
        self._arm_location = "center"

    async def _report(self) -> dict[str, Any]:
        return {"arm_location": self._arm_location}

    def move_container(self, container: Beaker, target_location: str) -> Beaker:
        if container.meta["location"] != target_location:
            if self._arm_location != container.meta["location"]:
                self.client.send_command(
                    "move", {"from_location": self._arm_location, "to_location": container.meta["location"]}
                )
                self._arm_location = container.meta["location"]

            self.client.send_command(
                "move", {"from_location": container.meta["location"], "to_location": target_location}
            )
            self._arm_location = target_location
            container.meta["location"] = target_location

            if self._arm_location != "center":
                self.client.send_command("move", {"from_location": self._arm_location, "to_location": "center"})
                self._arm_location = "center"

        return container

    def empty_container(self, container: Beaker, emptying_location: str) -> Beaker:
        container = self.move_container(container, emptying_location)
        result = self.client.send_command("empty", {})
        if result:
            container.meta["volume"] = 0
            for color in ["cyan", "magenta", "yellow", "black"]:
                container.meta.pop(f"{color}_volume", None)
                container.meta.pop(f"{color}_strength", None)
        return container
