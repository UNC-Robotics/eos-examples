from color_lab_sim.common.device_client import SimulationDevice
from color_lab_sim.resources import Beaker


class CleaningStation(SimulationDevice, type="cleaning_station"):
    """Cleaning station for rinsing a container."""

    class Config(SimulationDevice.Config):
        port: int = 5001

    def clean(self, container: Beaker, duration_sec: int = 1) -> Beaker:
        result = self.client.send_command("clean", {"duration_sec": duration_sec})
        if result:
            container.meta["clean"] = True
        return container
