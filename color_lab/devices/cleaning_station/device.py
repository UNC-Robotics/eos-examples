from typing import Dict, Any

from eos.containers.entities.container import Container
from eos.devices.base_device import BaseDevice
from user.eos_examples.color_lab.common.device_client import DeviceClient


class CleaningStation(BaseDevice):
    async def _initialize(self, init_parameters: Dict[str, Any]) -> None:
        port = int(init_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    async def _cleanup(self) -> None:
        self.client.close_connection()

    async def _report(self) -> Dict[str, Any]:
        return {}

    def clean(self, container: Container, duration_sec: int = 1) -> Container:
        result = self.client.send_command("clean", {"duration_sec": duration_sec})
        if result:
            container.meta["clean"] = True
        return container
