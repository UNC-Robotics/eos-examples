from pydantic import BaseModel

from eos import Resource


class Beaker(Resource, type="beaker"): ...


class BeakerOutputs(BaseModel):
    beaker: Beaker
