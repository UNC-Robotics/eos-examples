from typing import Dict, Any

from eos.resources.entities.resource import Resource
from eos.devices.base_device import BaseDevice
from user.eos_examples.color_lab.common.device_client import DeviceClient


class ColorMixer(BaseDevice):
    async def _initialize(self, init_parameters: Dict[str, Any]) -> None:
        port = int(init_parameters["port"])
        self.client = DeviceClient(port)
        self.client.open_connection()

    async def _cleanup(self) -> None:
        self.client.close_connection()

    async def _report(self) -> Dict[str, Any]:
        return {}

    def mix(
        self,
        container: Resource,
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
    ) -> Resource:
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

            container.meta[f"{color}_volume"] = container.meta.get(f"{color}_volume", 0) + volume
            container.meta[f"{color}_strength"] = strength
            total_volume += volume

        if "volume" not in container.meta:
            container.meta["volume"] = 0
        container.meta["volume"] += total_volume
        container.meta["clean"] = False
        container.meta["mixing_time"] = mixing_time
        container.meta["mixing_speed"] = mixing_speed
        container.meta["clean"] = False

        self.client.send_command("mix", params)

        return container
