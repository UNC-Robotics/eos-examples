from typing import Dict, Any

from eos.containers.entities.container import Container
from eos.devices.base_device import BaseDevice
from user.color_lab.common.device_client import DeviceClient


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

    def move_container(self, container: Container, target_location: str) -> Container:
        if container.location != target_location:
            if self._arm_location != container.location:
                self.client.send_command(
                    "move", {"from_location": self._arm_location, "to_location": container.location}
                )
                self._arm_location = container.location

            self.client.send_command("move", {"from_location": container.location, "to_location": target_location})
            self._arm_location = target_location
            container.location = target_location

            if self._arm_location != "center":
                self.client.send_command("move", {"from_location": self._arm_location, "to_location": "center"})
                self._arm_location = "center"

        return container

    def empty_container(self, container: Container, emptying_location: str) -> Container:
        container = self.move_container(container, emptying_location)
        result = self.client.send_command("empty", {})
        if result:
            container.metadata["volume"] = 0
            container.metadata = {}
        return container
