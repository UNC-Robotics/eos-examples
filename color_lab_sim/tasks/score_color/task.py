import math

from pydantic import BaseModel

from eos import Param, task


class ScoreOutputs(BaseModel):
    loss: float = Param(desc="Normalized color distance from the target color")


@task("Score Color")
async def score_color(
    red: int = Param(min=0, max=255, desc="The red component of the color"),
    green: int = Param(min=0, max=255, desc="The green component of the color"),
    blue: int = Param(min=0, max=255, desc="The blue component of the color"),
    target_color: tuple[int, int, int] = Param(desc="The expected RGB color"),
) -> ScoreOutputs:
    """Score a color based on how close it is to an expected color."""
    return ScoreOutputs(loss=math.dist((red, green, blue), target_color) / math.sqrt(3 * 255**2))
