from color_lab_sim.common.device_client import SimulationDevice
from color_lab_sim.resources import Beaker


class ColorStation(SimulationDevice, type="color_station"):
    """Color mixing and analysis station backed by a fluid simulation."""

    class Config(SimulationDevice.Config):
        port: int = 5003

    def mix(
        self,
        container: Beaker,
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
    ) -> Beaker:
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

        self.client.send_command("mix", params)

        return container

    def analyze(self, container: Beaker) -> tuple[Beaker, tuple[int, int, int]]:
        rgb = self.client.send_command("analyze", {})
        return container, rgb
