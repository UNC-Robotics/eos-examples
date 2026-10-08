import json
import socket
from typing import Any

from eos import Device


class DeviceClient:
    def __init__(self, port: int, timeout: float = 90.0):
        self.port = port
        self.sock = None
        self.timeout = timeout

    def open_connection(self):
        if not self.sock:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(self.timeout)
            self.sock.connect(("localhost", self.port))

    def close_connection(self):
        if self.sock:
            self.sock.close()
            self.sock = None

    def send_command(self, function: str, params: dict[str, Any]) -> Any:
        if not self.sock:
            raise ConnectionError("Connection is not open. Call open_connection() first.")

        command = json.dumps({"function": function, "params": params}) + "\n"
        self.sock.sendall(command.encode())

        response = self.sock.makefile().readline()

        if not response:
            raise ConnectionError(f"No data received from the server for command: {function}")

        try:
            result = json.loads(response.strip())
            if isinstance(result, dict) and "error" in result:
                raise RuntimeError(f"Server error for command {function}: {result['error']}")
            return result
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON received from the server for command {function}: {response}") from e


class SimulationDevice(Device):
    """A device backed by the fluid simulation, reached over a local socket."""

    class Config(Device.Config):
        port: int

    async def _initialize(self, config: Config) -> None:
        self.client = DeviceClient(config.port)
        self.client.open_connection()

    async def _cleanup(self) -> None:
        self.client.close_connection()
