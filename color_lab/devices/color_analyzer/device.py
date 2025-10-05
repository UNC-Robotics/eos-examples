from typing import Any

from eos.resources.entities.resource import Resource
from eos.devices.base_device import BaseDevice
from user.eos_examples.color_lab.common.device_client import DeviceClient


class ColorAnalyzer(BaseDevice):
    async def _initialize(self, init_parameters: dict[str, Any]) -> None:
        port = int(init_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    async def _cleanup(self) -> None:
        self.client.close_connection()

    async def _report(self) -> dict[str, Any]:
        return {}

    def analyze(self, container: Resource) -> tuple[Resource, tuple[int, int, int]]:
        rgb = self.client.send_command("analyze", {})
        return container, rgb
