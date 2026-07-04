#define RELAY_ACTIVE_LOW false

const int FAN_1_RELAY = 16;
const int FAN_2_RELAY = 17;
const int LIGHT_1_RELAY = 18;
const int LIGHT_2_RELAY = 19;
const int LIGHT_3_RELAY = 21;
const int CURRENT_SENSOR_ADC = 34;

const int relayPins[] = {
  FAN_1_RELAY,
  FAN_2_RELAY,
  LIGHT_1_RELAY,
  LIGHT_2_RELAY,
  LIGHT_3_RELAY
};

const char* relayLabels[] = {
  "Fan 1",
  "Fan 2",
  "Light 1",
  "Light 2",
  "Light 3"
};

const int relayCount = 5;

bool deviceStates[] = {
  false,
  false,
  false,
  false,
  false
};

void writeRelay(int pin, bool on) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(pin, on ? LOW : HIGH);
  } else {
    digitalWrite(pin, on ? HIGH : LOW);
  }
}

void setDevice(int index, bool on) {
  deviceStates[index] = on;
  writeRelay(relayPins[index], on);
}

int getCurrentWatts() {
  int watts = 0;

  // Fan 1
  if (deviceStates[0]) watts += 60;

  // Fan 2
  if (deviceStates[1]) watts += 60;

  // Light 1
  if (deviceStates[2]) watts += 15;

  // Light 2
  if (deviceStates[3]) watts += 15;

  // Light 3
  if (deviceStates[4]) watts += 15;

  return watts;
}

void printStatus(const char* scenarioName) {
  int rawAdc = analogRead(CURRENT_SENSOR_ADC);
  int watts = getCurrentWatts();

  Serial.println();
  Serial.print("Scenario: ");
  Serial.println(scenarioName);

  Serial.println("Work Room 1 simulated device states:");

  for (int i = 0; i < relayCount; i++) {
    Serial.print("- ");
    Serial.print(relayLabels[i]);
    Serial.print(": ");
    Serial.println(deviceStates[i] ? "ON" : "OFF");
  }

  Serial.print("Estimated load from device states: ");
  Serial.print(watts);
  Serial.println("W");

  Serial.print("Current sensor ADC reading on GPIO34: ");
  Serial.println(rawAdc);

  if (watts == 165) {
    Serial.println("Alert candidate: Work Room 1 is fully ON.");
  }

  Serial.println("----------------------------------");
}

void allOff() {
  for (int i = 0; i < relayCount; i++) {
    setDevice(i, false);
  }
}

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < relayCount; i++) {
    pinMode(relayPins[i], OUTPUT);
    setDevice(i, false);
  }

  analogReadResolution(12);
  analogSetPinAttenuation(CURRENT_SENSOR_ADC, ADC_11db);

  Serial.println("Office Power Monitor - Work Room 1 Wokwi simulation started");
  Serial.println("LEDs represent relay/load outputs.");
  Serial.println("Potentiometer represents room current sensor signal.");
}

void loop() {
  // Scenario 1: normal mixed state
  setDevice(0, true);   // Fan 1 ON
  setDevice(1, false);  // Fan 2 OFF
  setDevice(2, true);   // Light 1 ON
  setDevice(3, false);  // Light 2 OFF
  setDevice(4, true);   // Light 3 ON
  printStatus("Normal mixed usage");
  delay(4000);

  // Scenario 2: all devices ON
  setDevice(0, true);
  setDevice(1, true);
  setDevice(2, true);
  setDevice(3, true);
  setDevice(4, true);
  printStatus("All devices ON");
  delay(4000);

  // Scenario 3: lights left on
  setDevice(0, false);
  setDevice(1, false);
  setDevice(2, true);
  setDevice(3, true);
  setDevice(4, true);
  printStatus("Lights left ON");
  delay(4000);

  // Scenario 4: all OFF
  allOff();
  printStatus("All devices OFF");
  delay(4000);
}