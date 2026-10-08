import asyncio
import json
import os
import platform
import subprocess
import shutil
import tempfile
import argparse
import webbrowser
from pathlib import Path
from typing import Any, TypedDict, cast

import websockets
from aiohttp import web


def find_browser_executable(browser: str) -> str:
    """Locate Chrome or Edge without assuming the browser is on PATH."""
    system = platform.system()
    names = {
        "chrome": ["chrome.exe"] if system == "Windows" else ["google-chrome", "google-chrome-stable"],
        "edge": ["msedge.exe"] if system == "Windows" else ["microsoft-edge", "microsoft-edge-stable"],
    }
    for name in names[browser]:
        executable = shutil.which(name)
        if executable:
            return executable

    candidates: list[Path] = []
    if system == "Darwin":
        app_name = "Google Chrome" if browser == "chrome" else "Microsoft Edge"
        for root in (Path("/Applications"), Path.home() / "Applications"):
            candidates.append(root / f"{app_name}.app" / "Contents" / "MacOS" / app_name)
    elif system == "Windows":
        relative = (
            "Google/Chrome/Application/chrome.exe" if browser == "chrome" else "Microsoft/Edge/Application/msedge.exe"
        )
        for variable in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
            root = os.environ.get(variable)
            if root:
                candidates.append(Path(root) / relative)

    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise FileNotFoundError(f"Could not find {browser}. Install it or use --browser default --no-nvidia.")


class ColorData(TypedDict):
    r: int
    g: int
    b: int


class FluidSimulationServer:
    """Handles WebSocket connections for fluid simulation visualization."""

    def __init__(self, host: str = "localhost", port: int = 8030):
        """Initialize the server with host and port configuration."""
        self.host = host
        self.port = port
        self.client = None
        self.client_lock = asyncio.Lock()
        self.message_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.average_color: ColorData | None = None
        self.average_color_event = asyncio.Event()
        self.config_update_event = asyncio.Event()
        self.websocket_server = None

    async def handle_client(self, websocket) -> None:
        """Handle a new client WebSocket connection."""
        async with self.client_lock:
            if self.client is not None:
                await websocket.close(1008, "Server already has an active connection")
                return
            self.client = websocket
            try:
                print(f"Fluid simulation on port {self.port} connected")
                await asyncio.gather(self.receive_messages(websocket), self.send_messages(websocket))
            finally:
                self.client = None
                print(f"Fluid simulation on port {self.port} disconnected")

    async def receive_messages(self, websocket) -> None:
        """Receive and process messages from the client."""
        try:
            async for message in websocket:
                data = json.loads(message)
                if data["type"] == "averageColor":
                    self.average_color = cast(ColorData, data["color"])
                    self.average_color_event.set()
                elif data["type"] == "configUpdated":
                    self.config_update_event.set()
                else:
                    print(f"Received unknown message type: {data['type']}")
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed while receiving messages")
        except json.JSONDecodeError:
            print("Received invalid JSON")
        except Exception as e:
            print(f"Error receiving messages: {e}")

    async def send_messages(self, websocket) -> None:
        """Send queued messages to the client."""
        try:
            while True:
                message = await self.message_queue.get()
                await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed while sending messages")
        except Exception as e:
            print(f"Error sending messages: {e}")

    async def start_server(self) -> None:
        """Start the WebSocket server."""
        self.websocket_server = await websockets.serve(self.handle_client, self.host, self.port)
        print(f"Fluid simulation WebSocket server started on ws://{self.host}:{self.port}")

    async def send_message(self, message: dict[str, Any]) -> None:
        """Queue a message to be sent to the client."""
        await self.message_queue.put(message)


class FluidSimulationApi:
    """API for interacting with the fluid simulation."""

    def __init__(self, server: FluidSimulationServer):
        """Initialize the API with a server instance."""
        self.server = server

    async def update_config(self, key: str, value: Any) -> bool:
        """Update a configuration parameter in the simulation."""
        message = {"type": "updateConfig", "key": key, "value": value}
        await self.server.send_message(message)
        try:
            await asyncio.wait_for(self.server.config_update_event.wait(), timeout=5.0)
            return True
        except asyncio.TimeoutError:
            print(f"Timeout waiting for config update acknowledgment for {key}")
            return False
        finally:
            self.server.config_update_event.clear()

    async def clear_screen(self) -> None:
        """Clear the simulation display."""
        message = {"type": "clear"}
        await self.server.send_message(message)

    async def center_splat(self) -> None:
        """Create a splat in the center of the simulation."""
        message = {"type": "centerSplat"}
        await self.server.send_message(message)

    async def compute_average_color(self) -> ColorData | None:
        """Compute the average color of the simulation."""
        message = {"type": "computeAverageColor"}
        await self.server.send_message(message)
        try:
            await asyncio.wait_for(self.server.average_color_event.wait(), timeout=10.0)
            return self.server.average_color
        except asyncio.TimeoutError:
            print("Timeout waiting for average color response")
            return None
        finally:
            self.server.average_color_event.clear()


class BaseDeviceDriver:
    """Base class for device drivers with common functionality."""

    def __init__(self, enable_sleeping: bool = True):
        """Initialize the driver."""
        self.enable_sleeping = enable_sleeping

    async def conditional_sleep(self, duration_sec: float) -> None:
        """Sleep for the specified duration if enabled."""
        if self.enable_sleeping:
            await asyncio.sleep(duration_sec)


class CleaningStationDriver(BaseDeviceDriver):
    """Driver for the cleaning station device."""

    async def clean(self, duration_sec: int) -> bool:
        """Simulate cleaning for the specified duration."""
        await self.conditional_sleep(duration_sec)
        return True


class ColorStationDriver(BaseDeviceDriver):
    """Driver for the color station device (mixing and analysis)."""

    def __init__(self, fluid_sim_api: FluidSimulationApi, enable_sleeping: bool = True):
        """Initialize the driver with a fluid simulation API."""
        super().__init__(enable_sleeping)
        self.fluid_sim_api = fluid_sim_api

    async def mix(
        self,
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
        max_color_volume: float = 25,
    ) -> bool:
        """Mix colors in the simulation."""
        await self.fluid_sim_api.clear_screen()

        color_data = [
            ("cyan", cyan_volume, cyan_strength),
            ("magenta", magenta_volume, magenta_strength),
            ("yellow", yellow_volume, yellow_strength),
            ("black", black_volume, black_strength),
        ]

        # Process colors in reverse order (CMYK)
        color_data.reverse()

        # Count active colors (non-zero volume and strength)
        active_colors = sum(1 for _, volume, strength in color_data if volume > 0 and strength > 0)

        individual_mixing_time = mixing_time / active_colors if active_colors > 0 else 0

        await self.fluid_sim_api.update_config("VORTEX_STRENGTH", mixing_speed)

        for color, color_volume, color_strength in color_data:
            if color_volume <= 0 or color_strength <= 0:
                continue

            # Set simulation properties
            splat_radius = color_volume / max_color_volume
            await self.fluid_sim_api.update_config("SPLAT_RADIUS", splat_radius)
            await self.fluid_sim_api.update_config("COLOR", color.capitalize())
            await self.fluid_sim_api.update_config("COLOR_INTENSITY", color_strength)

            # Dispense color
            await self.fluid_sim_api.center_splat()
            await asyncio.sleep(0.25)

            # Mix
            await asyncio.sleep(individual_mixing_time)

        # Stop mixing and settle
        await self.fluid_sim_api.update_config("VORTEX_STRENGTH", 0)
        await asyncio.sleep(2)

        return True

    async def analyze(self) -> tuple[int, int, int]:
        """Analyze the current color in the simulation."""
        color = await self.fluid_sim_api.compute_average_color()
        await self.conditional_sleep(2)
        if color is None:
            return (0, 0, 0)  # Default if analysis fails
        return color["r"], color["g"], color["b"]


class RobotArmDriver(BaseDeviceDriver):
    """Driver for the robot arm device."""

    async def move(self, from_location: str, to_location: str) -> bool:
        """Move the robot arm between locations."""
        await self.conditional_sleep(1)
        return True

    async def empty(self) -> bool:
        """Empty the robot arm container."""
        await self.conditional_sleep(1)
        return True


async def handle_device(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, driver: Any) -> None:
    """Handle TCP connections to device drivers."""
    addr = writer.get_extra_info("peername")
    print(f"Established connection by {addr}")

    try:
        while True:
            data = await reader.readline()
            if not data:
                break

            try:
                command = json.loads(data.decode())

                if hasattr(driver, command["function"]):
                    method = getattr(driver, command["function"])
                    if asyncio.iscoroutinefunction(method):
                        result = await method(**command["params"])
                    else:
                        result = method(**command["params"])

                    response = json.dumps(result).encode() + b"\n"
                    writer.write(response)
                    await writer.drain()
                else:
                    error_response = json.dumps({"error": "Function not found"}).encode() + b"\n"
                    writer.write(error_response)
                    await writer.drain()
            except json.JSONDecodeError:
                error_response = json.dumps({"error": "Invalid JSON received"}).encode() + b"\n"
                writer.write(error_response)
                await writer.drain()
            except Exception as e:
                error_response = json.dumps({"error": str(e)}).encode() + b"\n"
                writer.write(error_response)
                await writer.drain()
    except Exception as e:
        print(f"Error handling connection: {e}")
    finally:
        print(f"Closing connection from {addr}")
        writer.close()
        await writer.wait_closed()


async def device_listener(driver: Any, port: int, device_name: str) -> None:
    """Start a TCP server for a device driver."""
    server = await asyncio.start_server(lambda r, w: handle_device(r, w, driver), "localhost", port)
    addr = server.sockets[0].getsockname()
    print(f"{device_name.capitalize()} driver listening on {addr}")

    async with server:
        await server.serve_forever()


class FluidSimulationManager:
    """Manages multiple fluid simulation instances."""

    def __init__(
        self,
        num_instances: int,
        enable_sleeping: bool = True,
        browser: str = "default",
        nvidia: bool | None = None,
        base_websocket_port: int = 8030,
        base_web_port: int = 9050,
    ):
        """Initialize the manager."""
        self.num_instances = num_instances
        self.base_websocket_port = base_websocket_port
        self.base_web_port = base_web_port
        self.enable_sleeping = enable_sleeping
        self.browser = browser
        self.nvidia = platform.system() == "Linux" and (
            nvidia if nvidia is not None else Path("/proc/driver/nvidia/gpus").is_dir()
        )
        self.browser_profile: tempfile.TemporaryDirectory | None = None
        self.browser_processes: list[subprocess.Popen] = []

        if self.nvidia and platform.system() == "Linux" and self.browser == "default":
            try:
                settings_command = shutil.which("xdg-settings")
                if not settings_command:
                    raise FileNotFoundError("xdg-settings is unavailable")
                default_browser = subprocess.run(
                    [settings_command, "get", "default-web-browser"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False,
                ).stdout.lower()
            except (OSError, subprocess.TimeoutExpired):
                default_browser = ""

            candidates = [("chrome", "google-chrome"), ("edge", "microsoft-edge")]
            if "edge" in default_browser:
                candidates.reverse()
            self.browser = next((name for name, executable in candidates if shutil.which(executable)), "default")
            if self.browser == "default":
                raise RuntimeError("NVIDIA offload requires Chrome or Edge. Install one or pass --no-nvidia.")
        self.browser_executable = find_browser_executable(self.browser) if self.browser != "default" else None

        self.fluid_servers: list[FluidSimulationServer] = []
        self.fluid_apis: list[FluidSimulationApi] = []
        self.web_runners: list[web.AppRunner] = []

    async def initialize_instances(self) -> None:
        """Initialize all simulation instances."""
        for i in range(self.num_instances):
            websocket_port = self.base_websocket_port + i
            web_port = self.base_web_port + i

            server = FluidSimulationServer(port=websocket_port)
            await server.start_server()
            self.fluid_servers.append(server)
            self.fluid_apis.append(FluidSimulationApi(server))

            await self.start_web_server(web_port, websocket_port)

    async def start_web_server(self, web_port: int, websocket_port: int) -> None:
        """Start a web server for a simulation instance."""
        app = web.Application()
        app.router.add_static("/", path=Path(__file__).resolve().parent / "fluid_simulation", name="static")

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "localhost", web_port)
        await site.start()

        print(f"Fluid simulation web server started on http://localhost:{web_port}")
        self.web_runners.append(runner)

        url = f"http://localhost:{web_port}/Fluid Simulation.html?port={websocket_port}"

        if self.browser == "default":
            webbrowser.open(url)
            return

        env = os.environ.copy()
        if self.nvidia and platform.system() == "Linux":
            env["__NV_PRIME_RENDER_OFFLOAD"] = "1"
            env["__GLX_VENDOR_LIBRARY_NAME"] = "nvidia"
            env["__VK_LAYER_NV_optimus"] = "NVIDIA_only"

        # A separate profile prevents an existing iGPU browser process from handling these windows.
        if self.browser_profile is None:
            self.browser_profile = tempfile.TemporaryDirectory(prefix="eos-fluid-browser-")
            print(f"Opening {self.browser} with NVIDIA offload {'enabled' if self.nvidia else 'disabled'}")

        cmd = [
            self.browser_executable,
            f"--user-data-dir={self.browser_profile.name}",
            "--incognito" if self.browser == "chrome" else "--inprivate",
            "--no-first-run",
            "--no-default-browser-check",
            "--new-window",
        ]
        # Native Wayland can keep Edge on the iGPU despite PRIME offload settings.
        if self.nvidia and os.environ.get("DISPLAY"):
            cmd.append("--ozone-platform=x11")
        cmd.append(url)
        self.browser_processes.append(await asyncio.to_thread(subprocess.Popen, cmd, env=env))

    def get_simulation_devices(self) -> dict[str, tuple[Any, int]]:
        """Get all simulation device drivers with their ports."""
        devices = {}
        for i, api in enumerate(self.fluid_apis):
            devices[f"color_station_{i + 1}"] = (ColorStationDriver(api, self.enable_sleeping), 5003 + i)
        return devices

    async def cleanup(self) -> None:
        """Clean up all resources."""
        for process in self.browser_processes:
            if process.poll() is None:
                process.terminate()
                try:
                    await asyncio.to_thread(process.wait, timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    await asyncio.to_thread(process.wait)
        if self.browser_profile is not None:
            self.browser_profile.cleanup()

        for runner in self.web_runners:
            await runner.cleanup()


async def main() -> None:
    """Main entry point for the application."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Fluid Simulation Server")
    parser.add_argument("--enable-sleeping", action="store_true", help="Enable sleeps in the simulation.")
    parser.add_argument(
        "--browser",
        choices=["default", "chrome", "edge"],
        default="default",
        help="Browser to use. 'default' uses system browser.",
    )
    parser.add_argument(
        "--nvidia",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="(Linux only) NVIDIA GPU offload. Auto-detected by default. Use --no-nvidia to disable.",
    )
    args = parser.parse_args()

    enable_sleeping = args.enable_sleeping
    print(f"Sleeping is {'enabled' if enable_sleeping else 'disabled'}")

    # Initialize fluid simulation manager
    fluid_sim_instances = 3
    fluid_sim_manager = FluidSimulationManager(
        fluid_sim_instances, enable_sleeping, browser=args.browser, nvidia=args.nvidia
    )
    await fluid_sim_manager.initialize_instances()

    # Set up all device drivers
    static_devices = {
        "cleaning_station": (CleaningStationDriver(enable_sleeping), 5001),
        "robot_arm": (RobotArmDriver(enable_sleeping), 5002),
    }
    fluid_sim_devices = fluid_sim_manager.get_simulation_devices()
    devices = {**static_devices, **fluid_sim_devices}

    # Start device listeners
    device_tasks = [
        asyncio.create_task(device_listener(driver, port, device_name))
        for device_name, (driver, port) in devices.items()
    ]

    # Fluid simulation tasks
    fluid_sim_tasks = [
        asyncio.create_task(server.websocket_server.wait_closed()) for server in fluid_sim_manager.fluid_servers
    ]

    # Run everything
    try:
        await asyncio.gather(*fluid_sim_tasks, *device_tasks)
    except asyncio.CancelledError:
        pass
    finally:
        for task in device_tasks:
            task.cancel()
        for task in fluid_sim_tasks:
            task.cancel()
        await fluid_sim_manager.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
