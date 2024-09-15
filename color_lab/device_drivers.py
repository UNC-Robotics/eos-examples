import asyncio
import json
import webbrowser
from typing import Any

import websockets
from aiohttp import web


class FluidSimulationServer:
    def __init__(self, host: str = "localhost", port: int = 8030):
        self.host = host
        self.port = port
        self.client = None
        self.client_lock = asyncio.Lock()
        self.message_queue = asyncio.Queue()
        self.average_color = None
        self.average_color_event = asyncio.Event()
        self.websocket_server = None

    async def handle_client(self, websocket):
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

    async def receive_messages(self, websocket):
        try:
            async for message in websocket:
                data = json.loads(message)
                if data["type"] == "averageColor":
                    self.average_color = data["color"]
                    self.average_color_event.set()
                else:
                    print(f"Received unknown message type: {data['type']}")
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed while receiving messages")
        except json.JSONDecodeError:
            print("Received invalid JSON")

    async def send_messages(self, websocket):
        try:
            while True:
                message = await self.message_queue.get()
                await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed while sending messages")

    async def start_server(self):
        self.websocket_server = await websockets.serve(self.handle_client, self.host, self.port)
        print(f"Fluid simulation WebSocket server started on ws://{self.host}:{self.port}")

    async def send_message(self, message: dict[str, Any]):
        await self.message_queue.put(message)


class FluidSimulationApi:
    def __init__(self, server: FluidSimulationServer):
        self.server = server

    async def update_config(self, key: str, value: Any):
        message = {"type": "updateConfig", "key": key, "value": value}
        await self.server.send_message(message)

    async def clear_screen(self):
        message = {"type": "clear"}
        await self.server.send_message(message)

    async def center_splat(self):
        message = {"type": "centerSplat"}
        await self.server.send_message(message)

    async def compute_average_color(self) -> dict[str, int] | None:
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


class CleaningStationDriver:
    async def clean(self, duration_sec: int) -> bool:
        await asyncio.sleep(duration_sec)
        return True


class ColorMixerDriver:
    def __init__(self, fluid_sim_api: FluidSimulationApi):
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
        await self.fluid_sim_api.clear_screen()

        color_data = [
            ("cyan", cyan_volume, cyan_strength),
            ("magenta", magenta_volume, magenta_strength),
            ("yellow", yellow_volume, yellow_strength),
            ("black", black_volume, black_strength),
        ]

        color_data.reverse()

        # Count non-zero volumes and strengths
        active_colors = sum(1 for color, volume, strength in color_data if volume != 0 and strength != 0)

        individual_mixing_time = mixing_time / active_colors if active_colors > 0 else 0

        await self.fluid_sim_api.update_config("VORTEX_STRENGTH", mixing_speed)

        for color, color_volume, color_strength in color_data:
            if color_volume == 0 or color_strength == 0:
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

        await self.fluid_sim_api.update_config("VORTEX_STRENGTH", 0)
        await asyncio.sleep(2)

        return True


class ColorAnalyzerDriver:
    def __init__(self, fluid_sim_api: FluidSimulationApi):
        self.fluid_sim_api = fluid_sim_api

    async def analyze(
        self,
    ) -> tuple[int, int, int]:
        color = await self.fluid_sim_api.compute_average_color()
        await asyncio.sleep(2)
        return color["r"], color["g"], color["b"]


class RobotArmDriver:
    async def move(self, from_location: str, to_location: str) -> bool:
        await asyncio.sleep(1)
        return True

    async def empty(self) -> bool:
        await asyncio.sleep(1)
        return True


async def handle_device(reader, writer, driver):
    addr = writer.get_extra_info("peername")
    print(f"Established connection by {addr}")
    while True:
        try:
            data = await reader.readline()
            if not data:
                break
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
    print(f"Closing connection from {addr}")
    writer.close()
    await writer.wait_closed()


async def device_listener(driver, port, device_name):
    server = await asyncio.start_server(lambda r, w: handle_device(r, w, driver), "localhost", port)
    addr = server.sockets[0].getsockname()
    print(f"{device_name.capitalize()} driver listening on {addr}")
    async with server:
        await server.serve_forever()


class FluidSimulationManager:
    def __init__(self, num_instances: int, base_websocket_port: int = 8030, base_web_port: int = 9050):
        self.num_instances = num_instances
        self.base_websocket_port = base_websocket_port
        self.base_web_port = base_web_port
        self.fluid_servers: list[FluidSimulationServer] = []
        self.fluid_apis: list[FluidSimulationApi] = []
        self.web_runners: list[web.AppRunner] = []

    async def initialize_instances(self):
        for i in range(self.num_instances):
            websocket_port = self.base_websocket_port + i
            web_port = self.base_web_port + i
            server = FluidSimulationServer(port=websocket_port)
            await server.start_server()
            self.fluid_servers.append(server)
            self.fluid_apis.append(FluidSimulationApi(server))
            await self.start_web_server(web_port, websocket_port)

    async def start_web_server(self, web_port: int, websocket_port: int):
        app = web.Application()
        app.router.add_static("/", path="./user/color_lab/fluid_simulation", name="static")
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "localhost", web_port)
        await site.start()
        print(f"Fluid simulation web server started on http://localhost:{web_port}")
        self.web_runners.append(runner)
        webbrowser.open(new=1, url=f"http://localhost:{web_port}/Fluid Simulation.html?port={websocket_port}")

    def get_simulation_devices(self):
        devices = {}
        for i, api in enumerate(self.fluid_apis):
            devices[f"color_analyzer_{i+1}"] = (ColorAnalyzerDriver(api), 5003 + i * 2)
            devices[f"color_mixer_{i+1}"] = (ColorMixerDriver(api), 5004 + i * 2)
        return devices

    async def cleanup(self):
        for runner in self.web_runners:
            await runner.cleanup()


async def main():
    fluid_sim_instances = 3
    fluid_sim_manager = FluidSimulationManager(fluid_sim_instances)
    await fluid_sim_manager.initialize_instances()

    static_devices = {
        "cleaning_station": (CleaningStationDriver(), 5001),
        "robot_arm": (RobotArmDriver(), 5002),
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
