from eos import Param, task

from color_lab_sim.devices.color_station.device import ColorStation
from color_lab_sim.resources import Beaker, BeakerOutputs


@task("Mix Colors")
async def mix_colors(
    color_station: ColorStation,
    beaker: Beaker,
    cyan_volume: float = Param(unit="mL", min=0, max=50, desc="The volume of cyan color to dispense"),
    cyan_strength: float = Param(unit="percent", min=0, max=100, desc="The strength of cyan color"),
    magenta_volume: float = Param(unit="mL", min=0, max=50, desc="The volume of magenta color to dispense"),
    magenta_strength: float = Param(unit="percent", min=0, max=100, desc="The strength of magenta color"),
    yellow_volume: float = Param(unit="mL", min=0, max=50, desc="The volume of yellow color to dispense"),
    yellow_strength: float = Param(unit="percent", min=0, max=100, desc="The strength of yellow color"),
    black_volume: float = Param(unit="mL", min=0, max=50, desc="The volume of black color to dispense"),
    black_strength: float = Param(unit="percent", min=0, max=100, desc="The strength of black color"),
    mixing_time: int = Param(unit="sec", desc="The amount of time to mix the contents of the container"),
    mixing_speed: int = Param(desc="The speed at which to stir the contents of the container"),
) -> BeakerOutputs:
    """Incrementally dispense and mix colors in a beaker."""
    beaker = color_station.mix(
        beaker,
        cyan_volume,
        cyan_strength,
        magenta_volume,
        magenta_strength,
        yellow_volume,
        yellow_strength,
        black_volume,
        black_strength,
        mixing_time,
        mixing_speed,
    )
    return BeakerOutputs(beaker=beaker)
