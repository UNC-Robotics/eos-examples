from typing import Dict, Any

from eos.resources.entities.resource import Resource
from eos.devices.base_device import BaseDevice
from user.eos_examples.color_lab.common.device_client import DeviceClient


class RobotArm(BaseDevice):
    async def _initialize(self, init_parameters: Dict[str, Any]) -> None:
        port = int(init_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

        self._arm_location = "center"

    async def _cleanup(self) -> None:
        self.client.close_connection()

    async def _report(self) -> Dict[str, Any]:
        return {"arm_location": self._arm_location}

    def move_container(self, container: Resource, target_location: str) -> Resource:
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

    def empty_container(self, container: Resource, emptying_location: str) -> Resource:
        container = self.move_container(container, emptying_location)
        result = self.client.send_command("empty", {})
        if result:
            container.meta["volume"] = 0
        return container
