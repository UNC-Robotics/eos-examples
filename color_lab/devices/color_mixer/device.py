from typing import Dict, Any

from eos.containers.entities.container import Container
from eos.devices.base_device import BaseDevice
from user.color_lab.common.device_client import DeviceClient


class ColorMixerDevice(BaseDevice):
    def _initialize(self, initialization_parameters: Dict[str, Any]) -> None:
        port = int(initialization_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    def _cleanup(self) -> None:
        self.client.close_connection()

    def _report(self) -> Dict[str, Any]:
        return {}

    def mix(
        self,
        container: Container,
        cyan_volume: float,
        cyan_strength: float,
        magenta_volume: float,
        magenta_strength: float,
        yellow_volume: float,
        yellow_strength: float,
        black_volume: float,
        black_strength: float,
        mixing_time: int,
        mixing_speed: int,
    ) -> Container:
        params = {
            "cyan_volume": cyan_volume,
            "cyan_strength": cyan_strength,
            "magenta_volume": magenta_volume,
            "magenta_strength": magenta_strength,
            "yellow_volume": yellow_volume,
            "yellow_strength": yellow_strength,
            "black_volume": black_volume,
            "black_strength": black_strength,
            "mixing_time": mixing_time,
            "mixing_speed": mixing_speed,
        }
        total_volume = 0
        for color in ["cyan", "magenta", "yellow", "black"]:
            volume = params[f"{color}_volume"]
            strength = params[f"{color}_strength"]

            container.metadata[f"{color}_volume"] = container.metadata.get(f"{color}_volume", 0) + volume
            container.metadata[f"{color}_strength"] = strength
            total_volume += volume

        if "volume" not in container.metadata:
            container.metadata["volume"] = 0
        container.metadata["volume"] += total_volume
        container.metadata["clean"] = False
        container.metadata["mixing_time"] = mixing_time
        container.metadata["mixing_speed"] = mixing_speed
        container.metadata["clean"] = False

        self.client.send_command("mix", params)

        return container
