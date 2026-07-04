# Hardware

This directory documents the physical hardware setup for deploying the Office
Power Monitor on real infrastructure (beyond the software simulator).

## Contents

| File                   | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| [pinout.md](pinout.md) | GPIO pin assignments for Raspberry Pi / microcontrollers |
| [wiring.md](wiring.md) | Wiring diagrams and circuit schematics                   |

## Overview

The software simulator (`backend/src/simulator/`) can be swapped for an MQTT
bridge that reads real sensor data. See [docs/HARDWARE.md](../docs/HARDWARE.md)
for the full deployment guide.

### Supported Hardware

- **Raspberry Pi** 3B+ / 4 / Zero 2W
- **Current sensors** — SCT-013 (30A non-invasive split-core)
- **ADC** — ADS1115 (16-bit, I²C)
- **Relay module** — 5V 4-channel optocoupler relay for device control

### Quick Integration

1. Flash Raspberry Pi OS Lite
2. Enable I²C via `raspi-config`
3. Wire ADS1115 to GPIO (see [pinout.md](pinout.md))
4. Replace `backend/src/simulator/simulator.js` with the MQTT client
5. Point the MQTT broker at the backend host
