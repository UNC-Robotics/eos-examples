from eos import Param, task

from color_lab_sim.devices.cleaning_station.device import CleaningStation
from color_lab_sim.resources import Beaker, BeakerOutputs


@task("Clean Container")
async def clean_container(
    cleaning_station: CleaningStation,
    beaker: Beaker,
    duration: int = Param(unit="sec", desc="How long to clean"),
) -> BeakerOutputs:
    """Clean a container by rinsing it."""
    return BeakerOutputs(beaker=cleaning_station.clean(beaker, duration_sec=duration))
