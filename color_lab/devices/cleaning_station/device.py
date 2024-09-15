from typing import Dict, Any

from eos.containers.entities.container import Container
from eos.devices.base_device import BaseDevice
from user.color_lab.common.device_client import DeviceClient


class CleaningStationDevice(BaseDevice):
    def _initialize(self, initialization_parameters: Dict[str, Any]) -> None:
        port = int(initialization_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    def _cleanup(self) -> None:
        self.client.close_connection()

    def _report(self) -> Dict[str, Any]:
        return {}

    def clean(self, container: Container, duration_sec: int = 1) -> Container:
        result = self.client.send_command("clean", {"duration_sec": duration_sec})
        if result:
            container.metadata["clean"] = True
        return container
