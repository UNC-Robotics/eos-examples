from eos import Param, task

from color_lab_sim.devices.color_station.device import ColorStation
from color_lab_sim.resources import Beaker, BeakerOutputs


class AnalyzeOutputs(BeakerOutputs):
    red: int = Param(desc="The red component of the color")
    green: int = Param(desc="The green component of the color")
    blue: int = Param(desc="The blue component of the color")


@task("Analyze Color")
async def analyze_color(color_station: ColorStation, beaker: Beaker) -> AnalyzeOutputs:
    """Analyze the color of a solution."""
    beaker, (red, green, blue) = color_station.analyze(beaker)
    return AnalyzeOutputs(beaker=beaker, red=red, green=green, blue=blue)
