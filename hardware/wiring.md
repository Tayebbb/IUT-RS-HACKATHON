# Wiring Diagram

## Overview

```
AC Mains ──┬─── SCT-013 (CH0) ───┐
           ├─── SCT-013 (CH1) ───┤    ADS1115 (I²C 0x48)
           └─── SCT-013 (CH2) ───┤     ┌──────────────┐
                                  └────►│ A0  A1  A2   │
                                        │              │
                                        │ SDA ──► RPi GPIO2
                                        │ SCL ──► RPi GPIO3
                                        │ VDD ──► 3.3V
                                        │ GND ──► GND
                                        └──────────────┘
```

## Burden Resistors

Each SCT-013 output connects to an ADS1115 input through a **33Ω burden
resistor** in parallel with the input pin.

```
SCT-013 (+) ─────┬──── ADS1115 Ax
                 │
               [33Ω]
                 │
SCT-013 (-) ─────┴──── GND
```

## Power Supply

- Raspberry Pi powered via USB-C (5V/3A)
- ADS1115 powered from RPi 3.3V rail
- Relay module powered from RPi 5V rail (separate from 3.3V logic)

## Notes

- Use shielded cable for sensor leads to reduce EMI
- Keep sensor wiring away from mains cables
- Test with a clamp meter before relying on readings
