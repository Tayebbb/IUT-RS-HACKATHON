# GPIO Pinout — Raspberry Pi 4

## ADS1115 (I²C ADC for current sensors)

| ADS1115 Pin | RPi GPIO     | RPi Pin # | Notes              |
| ----------- | ------------ | --------- | ------------------ |
| VDD         | 3.3V         | 1         | Power              |
| GND         | GND          | 6         | Ground             |
| SCL         | GPIO 3 (SCL) | 5         | I²C Clock          |
| SDA         | GPIO 2 (SDA) | 3         | I²C Data           |
| ADDR        | GND          | 6         | I²C address 0x48   |
| A0          | —            | —         | Current sensor CH0 |
| A1          | —            | —         | Current sensor CH1 |
| A2          | —            | —         | Current sensor CH2 |
| A3          | —            | —         | (spare / future)   |

## Relay Module (device switching — optional)

| Relay IN | RPi GPIO | Function           |
| -------- | -------- | ------------------ |
| IN1      | GPIO 17  | Drawing Room Fan 1 |
| IN2      | GPIO 27  | Drawing Room Fan 2 |
| IN3      | GPIO 22  | Work Room 1 Fan 1  |
| IN4      | GPIO 23  | Work Room 1 Fan 2  |
| VCC      | 5V       | Power              |
| GND      | GND      | Ground             |

## SCT-013 Current Sensors

Wire each sensor's output jack to one ADS1115 analog input via a burden resistor
(33Ω recommended for ±1A peak on 3.3V supply).

> **Safety**: Always use non-invasive split-core sensors around mains wiring.
> Never cut live wires.
