from typing import Any

from eos.containers.entities.container import Container
from eos.devices.base_device import BaseDevice
from user.color_lab.common.device_client import DeviceClient


class ColorAnalyzerDevice(BaseDevice):
    def _initialize(self, initialization_parameters: dict[str, Any]) -> None:
        port = int(initialization_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    def _cleanup(self) -> None:
        self.client.close_connection()

    def _report(self) -> dict[str, Any]:
        return {}

    def analyze(self, container: Container) -> tuple[Container, tuple[int, int, int]]:
        rgb = self.client.send_command("analyze", {})
        return container, rgb
