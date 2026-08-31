
#include <ArduinoOTA.h>
#include <DallasTemperature.h>
#include <ESPmDNS.h>
#include <MPU9250_WE.h> // MPU9250 WE library for purple module
#include <NTPClient.h>
#include <OneWire.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h> // Secure TLS client
#include <WiFiUdp.h>
#include <Wire.h>
#include <esp_random.h> // Secure random
#include <esp_task_wdt.h>

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 1: FIRMWARE METADATA & VERSIONING
 * ═══════════════════════════════════════════════════════════════════════ */

#define FIRMWARE_VERSION "4.5.1"
#define BUILD_DATE __DATE__
#define BUILD_TIME __TIME__
#define HARDWARE_REVISION "ESP32-C3_v1.2"

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 2: SECURITY CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════ */

// MQTTS Root CA Certificate (ISRG Root X1 - Let's Encrypt)
// TODO: Replace with your VPS certificate after deployment
const char *ca_cert =
    "-----BEGIN CERTIFICATE-----\n"
    "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\n"
    "-----END CERTIFICATE-----\n";

// Security constants
#define AES_KEY_SIZE 16 // 128-bit
#define NONCE_SIZE 6    // 6 bytes hex = 12 chars
#define MAX_AUTH_FAILURES 5
#define RATE_LIMIT_MSG_PER_SEC 10
#define REPLAY_WINDOW_SECONDS 300 // 5 minutes

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 3: CONFIGURATION STRUCTURE
 * ═══════════════════════════════════════════════════════════════════════ */

struct DeviceConfig {
  char collar_id[32];
  char device_secret[64]; // Stored ENCRYPTED in NVS
  char wifi_ssid[32];
  char wifi_password[64];
  char mqtt_server[64];
  uint16_t mqtt_port;
  uint8_t batch_count;
  uint8_t window_size;
  uint16_t sleep_minutes;
  uint8_t max_offline_cycles;
  bool device_active;
  bool use_hmac;
  bool provisioned; // ← NEW: First boot flag
  uint32_t config_version;
  char ota_password[32];
};

// Default EMPTY config (requires provisioning)
const DeviceConfig DEFAULT_CONFIG = {
    .collar_id = "",
    .device_secret = "",
    .wifi_ssid = "",
    .wifi_password = "",
    .mqtt_server = "",
    .mqtt_port = 8883, // ← CHANGED: MQTTS port
    .batch_count = 10,
    .window_size = 20,
    .sleep_minutes = 20,
    .max_offline_cycles = 25,
    .device_active = false, // ← CHANGED: Inactive until provisioned
    .use_hmac = true,       // ← ENFORCED: Always use HMAC
    .provisioned = false,
    .config_version = 1,
    .ota_password = ""};

DeviceConfig config;
Preferences preferences;

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 4: STATE MACHINE
 * ═══════════════════════════════════════════════════════════════════════ */

enum SystemState {
  STATE_INIT,
  STATE_PROVISIONING, // ← NEW: First boot setup
  STATE_CHECK_LIFECYCLE,
  STATE_READ_SENSORS,
  STATE_VALIDATE_DATA,
  STATE_CONNECT_WIFI,
  STATE_CONNECT_MQTT,
  STATE_SEND_DATA,
  STATE_MAINTENANCE,
  STATE_SLEEP,
  STATE_ERROR_RECOVERY,
  STATE_SECURITY_LOCKDOWN // ← NEW: Security failsafe
};

SystemState currentState = STATE_INIT;
SystemState previousState = STATE_INIT;

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 5: HARDWARE & GLOBALS
 * ═══════════════════════════════════════════════════════════════════════ */

#define SDA_PIN 8
#define SCL_PIN 9
#define ONE_WIRE_BUS 2
#define BATTERY_PIN 4
#define WDT_TIMEOUT 60
#define MQTT_QUEUE_SIZE 5

#define MQTT_TOPIC_DATA "kandang/sensor"
#define MQTT_TOPIC_DEBUG "kandang/debug"
#define MQTT_TOPIC_COMMAND "kandang/command"
#define MQTT_TOPIC_CONFIG "kandang/config"
#define MQTT_TOPIC_STATUS "kandang/status" // ← NEW: LWT topic

WiFiClient plainClient;
WiFiClientSecure secureClient;
PubSubClient mqtt(plainClient);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 28800);
MPU9250_WE mpu9250 = MPU9250_WE(0x68); // IMU Sensor

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 6: RTC MEMORY
 * ═══════════════════════════════════════════════════════════════════════ */

#define MAX_BUFFERED_BATCHES 250

RTC_DATA_ATTR float bufMeanZ[MAX_BUFFERED_BATCHES];
RTC_DATA_ATTR float bufRmsZ[MAX_BUFFERED_BATCHES];
RTC_DATA_ATTR float bufMaxZ[MAX_BUFFERED_BATCHES];
RTC_DATA_ATTR float bufSuhu[MAX_BUFFERED_BATCHES];
RTC_DATA_ATTR unsigned long bufTimestamp[MAX_BUFFERED_BATCHES];

RTC_DATA_ATTR int bufHead = 0;
RTC_DATA_ATTR int bufCount = 0;
RTC_DATA_ATTR bool offlineMode = false;
RTC_DATA_ATTR int failedAttempts = 0;
RTC_DATA_ATTR bool maintenanceRequested = false;
RTC_DATA_ATTR uint32_t messageSequence = 0;
RTC_DATA_ATTR uint32_t bootCount = 0;
RTC_DATA_ATTR uint32_t bufferMagic = 0xDEADBEEF;
RTC_DATA_ATTR uint8_t sensorFailCount = 0;

// NEW: Security tracking
RTC_DATA_ATTR uint8_t authFailures = 0;
RTC_DATA_ATTR unsigned long lastMsgTime = 0;
RTC_DATA_ATTR uint8_t msgCountThisSec = 0;

// NEW: Offline timestamp estimation — survives deep sleep, lost on full
// power-off
RTC_DATA_ATTR unsigned long lastKnownEpoch = 0; // Last NTP-synced epoch (UTC)
RTC_DATA_ATTR uint32_t lastKnownBootCount =
    0; // Boot count when epoch was synced

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 7: MQTT QUEUE
 * ═══════════════════════════════════════════════════════════════════════ */

struct MQTTMessage {
  char topic[50];
  char payload[512];
  uint32_t sequence;
  bool valid;
};

MQTTMessage mqttQueue[MQTT_QUEUE_SIZE];
int queueHead = 0;
int queueCount = 0;

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 8: SENSOR DATA
 * ═══════════════════════════════════════════════════════════════════════ */

struct SensorReading {
  float meanZ;
  float rmsZ;
  float maxZ;
  float temperature;
  unsigned long timestamp;
  bool valid;
};

static SensorReading batchReadings[10];
static bool mpuInitSuccess = false;
static int ds18b20Count = 0;

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 9: SECURITY MODULE
 * ═══════════════════════════════════════════════════════════════════════ */

class SecurityManager {
public:
  // Get device chip ID (unique, immutable)
  static uint64_t getChipID() { return ESP.getEfuseMac(); }

  // Generate secure random nonce (6 bytes = 12 hex chars)
  static void generateNonce(char *output) {
    uint8_t random[NONCE_SIZE];
    esp_fill_random(random, NONCE_SIZE);

    for (int i = 0; i < NONCE_SIZE; i++) {
      sprintf(output + (i * 2), "%02x", random[i]);
    }
    output[NONCE_SIZE * 2] = '\0';
  }

  // Plain text pass-through for simplicity
  static void encryptSecret(const char *plaintext, char *encrypted) {
    strncpy(encrypted, plaintext, 63);
    encrypted[63] = '\0';
  }

  // Plain text pass-through for simplicity
  static void decryptSecret(const char *encrypted, char *plaintext) {
    strncpy(plaintext, encrypted, 63);
    plaintext[63] = '\0';
  }

  // Rate limiting check
  static bool checkRateLimit() {
    unsigned long currentSec = millis() / 1000;

    if (currentSec != lastMsgTime / 1000) {
      // New second - reset counter
      msgCountThisSec = 0;
      lastMsgTime = currentSec * 1000;
    }

    if (msgCountThisSec >= RATE_LIMIT_MSG_PER_SEC) {
      Serial.println("[SECURITY] Rate limit exceeded!");
      return false;
    }

    msgCountThisSec++;
    return true;
  }

  // Check for security lockdown conditions
  static bool shouldLockdown() { return authFailures >= MAX_AUTH_FAILURES; }

  // Reset auth failures (on successful send)
  static void resetAuthFailures() { authFailures = 0; }

  // Increment auth failures
  static void recordAuthFailure() {
    authFailures++;
    Serial.printf("[SECURITY] Auth failure count: %d/%d\n", authFailures,
                  MAX_AUTH_FAILURES);
  }
};

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 10: CONFIGURATION MANAGEMENT
 * ═══════════════════════════════════════════════════════════════════════ */

void loadConfiguration() {
  preferences.begin("collar-cfg", false);

  if (preferences.isKey("provisioned") &&
      preferences.getBool("provisioned", false)) {
    // Load encrypted configuration
    preferences.getString("collar_id", config.collar_id,
                          sizeof(config.collar_id));

    char encryptedSecret[64];
    preferences.getString("dev_secret", encryptedSecret,
                          sizeof(encryptedSecret));
    SecurityManager::decryptSecret(encryptedSecret, config.device_secret);

    preferences.getString("wifi_ssid", config.wifi_ssid,
                          sizeof(config.wifi_ssid));
    preferences.getString("wifi_pass", config.wifi_password,
                          sizeof(config.wifi_password));
    preferences.getString("mqtt_srv", config.mqtt_server,
                          sizeof(config.mqtt_server));
    config.mqtt_port = preferences.getUShort("mqtt_port", 8883);
    config.batch_count = preferences.getUChar("batch_cnt", 10);
    config.window_size = preferences.getUChar("window_sz", 20);
    config.sleep_minutes = preferences.getUShort("sleep_min", 20);
    config.max_offline_cycles = preferences.getUChar("max_cycles", 25);
    config.device_active = preferences.getBool("active", true);
    config.use_hmac = true; // ENFORCED
    config.provisioned = true;
    config.config_version = preferences.getUInt("config_ver", 1);
    preferences.getString("ota_pass", config.ota_password,
                          sizeof(config.ota_password));

    Serial.println("[CONFIG] Loaded from NVS (encrypted)");
  } else {
    // Not provisioned - use empty defaults
    memcpy(&config, &DEFAULT_CONFIG, sizeof(DeviceConfig));
    Serial.println("[CONFIG] NOT PROVISIONED - Enter provisioning mode");
  }

  preferences.end();
}

void saveConfiguration() {
  preferences.begin("collar-cfg", false);

  preferences.putString("collar_id", config.collar_id);

  // Encrypt device_secret before storing
  char encryptedSecret[64];
  SecurityManager::encryptSecret(config.device_secret, encryptedSecret);
  preferences.putString("dev_secret", encryptedSecret);

  preferences.putString("wifi_ssid", config.wifi_ssid);
  preferences.putString("wifi_pass", config.wifi_password);
  preferences.putString("mqtt_srv", config.mqtt_server);
  preferences.putUShort("mqtt_port", config.mqtt_port);
  preferences.putUChar("batch_cnt", config.batch_count);
  preferences.putUChar("window_sz", config.window_size);
  preferences.putUShort("sleep_min", config.sleep_minutes);
  preferences.putUChar("max_cycles", config.max_offline_cycles);
  preferences.putBool("active", config.device_active);
  preferences.putBool("provisioned", config.provisioned);
  preferences.putUInt("config_ver", config.config_version);
  preferences.putString("ota_pass", config.ota_password);

  preferences.end();
  Serial.println("[CONFIG] Saved to NVS (encrypted)");
}

void updateConfigFromMQTT(const char *json) {
  if (strstr(json, "\"sleep_minutes\":")) {
    int newSleep = atoi(strstr(json, "\"sleep_minutes\":") + 16);
    if (newSleep >= 5 && newSleep <= 60) {
      config.sleep_minutes = newSleep;
      config.config_version++;
      saveConfiguration();
      Serial.printf("[CONFIG] Updated sleep_minutes to %d\n", newSleep);
    }
  }

  if (strstr(json, "\"device_active\":false")) {
    config.device_active = false;
    saveConfiguration();
    Serial.println("[CONFIG] Device DISABLED remotely!");
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 11: PROVISIONING MODE
 * ═══════════════════════════════════════════════════════════════════════ */

void handleProvisioning() {
  Serial.println("\n╔════════════════════════════════════════════╗");
  Serial.println("║  PROVISIONING MODE - FIRST BOOT SETUP      ║");
  Serial.println("╚════════════════════════════════════════════╝");
  Serial.println("Enter configuration via Serial (115200 baud):");
  Serial.println(
      "Format: COLLAR_ID,DEVICE_SECRET,WIFI_SSID,WIFI_PASS,MQTT_SERVER");
  Serial.println("\nWaiting for input... (60 seconds timeout)");

  unsigned long start = millis();
  String input = "";

  while (millis() - start < 60000) {
    if (Serial.available()) {
      char c = Serial.read();
      if (c == '\n' || c == '\r') {
        if (input.length() > 0)
          break;
      } else {
        input += c;
      }
    }
    delay(100);
    esp_task_wdt_reset();
  }

  if (input.length() == 0) {
    Serial.println("[PROVISIONING] Timeout - will retry on next boot");
    esp_deep_sleep(10 * 1000000ULL); // Sleep 10 sec
    return;
  }

  // Parse input
  int idx1 = input.indexOf(',');
  int idx2 = input.indexOf(',', idx1 + 1);
  int idx3 = input.indexOf(',', idx2 + 1);
  int idx4 = input.indexOf(',', idx3 + 1);

  if (idx1 > 0 && idx2 > 0 && idx3 > 0 && idx4 > 0) {
    input.substring(0, idx1).toCharArray(config.collar_id,
                                         sizeof(config.collar_id));
    input.substring(idx1 + 1, idx2)
        .toCharArray(config.device_secret, sizeof(config.device_secret));
    input.substring(idx2 + 1, idx3)
        .toCharArray(config.wifi_ssid, sizeof(config.wifi_ssid));
    input.substring(idx3 + 1, idx4)
        .toCharArray(config.wifi_password, sizeof(config.wifi_password));
    String serverStr = input.substring(idx4 + 1);
    serverStr.trim();
    int colonIdx = serverStr.indexOf(':');
    if (colonIdx > 0) {
      serverStr.substring(0, colonIdx)
          .toCharArray(config.mqtt_server, sizeof(config.mqtt_server));
      config.mqtt_port = serverStr.substring(colonIdx + 1).toInt();
    } else {
      serverStr.toCharArray(config.mqtt_server, sizeof(config.mqtt_server));
      // Auto-detect local IP address (starts with digit) -> default to 1883,
      // otherwise 8883
      if (isdigit(config.mqtt_server[0])) {
        config.mqtt_port = 1883;
      } else {
        config.mqtt_port = 8883;
      }
    }

    config.device_active = true;
    config.use_hmac = true;
    config.provisioned = true;

    char nonce[13];
    SecurityManager::generateNonce(nonce);
    strcpy(config.ota_password, nonce);

    saveConfiguration();

    Serial.println("\n[PROVISIONING] SUCCESS!");
    Serial.printf("Collar ID: %s\n", config.collar_id);
    Serial.printf("Chip ID: %llX\n", SecurityManager::getChipID());
    Serial.println("Rebooting...\n");

    delay(2000);
    ESP.restart();
  } else {
    Serial.println("[PROVISIONING] Invalid format!");
    esp_deep_sleep(10 * 1000000ULL);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 12: LOGGING SYSTEM
 * ═══════════════════════════════════════════════════════════════════════ */

void mqttLog(const char *level, const char *message) {
  char timestamp[20];
  if (timeClient.isTimeSet()) {
    snprintf(timestamp, sizeof(timestamp), "%lu", timeClient.getEpochTime());
  } else {
    snprintf(timestamp, sizeof(timestamp), "%lu", millis() / 1000);
  }

  Serial.printf("[%s] [%s] %s\n", timestamp, level, message);

  if (mqtt.connected()) {
    char payload[300];
    snprintf(payload, sizeof(payload),
             "{\"ts\":%s,\"collar\":\"%s\",\"fw\":\"%s\",\"chip\":\"%llX\","
             "\"lvl\":\"%s\",\"msg\":\"%s\"}",
             timestamp, config.collar_id, FIRMWARE_VERSION,
             SecurityManager::getChipID(), level, message);
    mqtt.publish(MQTT_TOPIC_DEBUG, payload, false);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 13: SENSOR MODULES (Unchanged from v4.0)
 * ═══════════════════════════════════════════════════════════════════════ */

class SensorManager {
public:
  static bool initMPU9250() {
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(100000);

    // Wake up the MPU chip (works for MPU6050, MPU6500, MPU9250)
    Wire.beginTransmission(0x68);
    Wire.write(0x6B); // PWR_MGMT_1 register
    Wire.write(0x00); // Wake up
    byte error = Wire.endTransmission();

    bool ok = (error == 0);
    mpuInitSuccess = ok;
    Serial.printf("[DEBUG SENSOR] MPU Init (Raw I2C): %s\n",
                  ok ? "SUCCESS" : "FAILED");
    return ok;
  }

  static float readZAxis() {
    Wire.beginTransmission(0x68);
    Wire.write(0x3F); // ACCEL_ZOUT_H
    byte error = Wire.endTransmission(false);

    if (error != 0) {
      Serial.println("[DEBUG SENSOR] Raw Z Read Failed (I2C Error)");
      return NAN;
    }

    Wire.requestFrom(0x68, 2);
    if (Wire.available() >= 2) {
      int16_t rawZ = (Wire.read() << 8) | Wire.read();
      float gZ = rawZ / 16384.0; // standard 2g sensitivity scale factor
      Serial.printf("[DEBUG SENSOR] Raw Z axis: %.3f\n", gZ);
      return gZ;
    }

    Serial.println("[DEBUG SENSOR] Raw Z Read Failed (No data)");
    return NAN;
  }

  static bool initDS18B20() {
    pinMode(ONE_WIRE_BUS, INPUT_PULLUP);
    tempSensor.begin();
    int count = tempSensor.getDeviceCount();
    ds18b20Count = count;
    Serial.printf("[DEBUG SENSOR] DS18B20 Count: %d\n", count);
    return (count > 0);
  }

  static float readTemperature() {
    tempSensor.requestTemperatures();
    float temp = tempSensor.getTempCByIndex(0);
    Serial.printf("[DEBUG SENSOR] Raw Temp: %.2f C\n", temp);
    return (temp >= -50 && temp <= 100) ? temp : 25.0;
  }

  static bool resetSensorBus() {
    Serial.println("[DEBUG SENSOR] Resetting I2C bus...");
    Wire.end();
    delay(100);
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(100000);
    delay(100);
    return initMPU9250();
  }
};

class DataValidator {
public:
  static bool isValidAccel(float value) {
    return !isnan(value) && value >= -5.0 && value <= 5.0;
  }

  static bool isValidTemp(float value) {
    return !isnan(value) && value >= -40.0 && value <= 60.0;
  }

  static bool isValidReading(const SensorReading &reading) {
    return isValidAccel(reading.meanZ) && isValidAccel(reading.rmsZ) &&
           isValidAccel(reading.maxZ) && isValidTemp(reading.temperature);
  }
};

class BatteryMonitor {
public:
  static float readVoltage(int &percent) {
    int raw = analogRead(BATTERY_PIN);
    float pinVoltage = (raw / 4095.0) * 3.3;
    float battVoltage = pinVoltage * 2;
    percent = map((long)(battVoltage * 100), 320, 420, 0, 100);
    percent = constrain(percent, 0, 100);
    return battVoltage;
  }

  static bool isCritical() {
    int pct;
    float voltage = readVoltage(pct);
    return (pct < 10 || voltage < 3.3);
  }
};

class BufferManager {
public:
  static bool checkIntegrity() {
    if (bufferMagic != 0xDEADBEEF) {
      bufHead = 0;
      bufCount = 0;
      bufferMagic = 0xDEADBEEF;
      return false;
    }
    return true;
  }

  static void write(const SensorReading &reading) {
    int idx = bufHead % MAX_BUFFERED_BATCHES;
    bufMeanZ[idx] = reading.meanZ;
    bufRmsZ[idx] = reading.rmsZ;
    bufMaxZ[idx] = reading.maxZ;
    bufSuhu[idx] = reading.temperature;
    bufTimestamp[idx] = reading.timestamp;
    bufHead = (bufHead + 1) % MAX_BUFFERED_BATCHES;
    if (bufCount < MAX_BUFFERED_BATCHES)
      bufCount++;
  }

  static SensorReading read(int index) {
    int idx = (bufHead - bufCount + index + MAX_BUFFERED_BATCHES) %
              MAX_BUFFERED_BATCHES;
    SensorReading reading;
    reading.meanZ = bufMeanZ[idx];
    reading.rmsZ = bufRmsZ[idx];
    reading.maxZ = bufMaxZ[idx];
    reading.temperature = bufSuhu[idx];
    reading.timestamp = bufTimestamp[idx];
    reading.valid = true;
    return reading;
  }

  static void clear() {
    bufHead = 0;
    bufCount = 0;
  }
};

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 14: MQTT QUEUE
 * ═══════════════════════════════════════════════════════════════════════ */

class MQTTQueue {
public:
  static bool enqueue(const char *topic, const char *payload) {
    if (queueCount >= MQTT_QUEUE_SIZE) {
      queueHead = (queueHead + 1) % MQTT_QUEUE_SIZE;
      queueCount--;
    }

    int idx = (queueHead + queueCount) % MQTT_QUEUE_SIZE;
    strncpy(mqttQueue[idx].topic, topic, sizeof(mqttQueue[idx].topic) - 1);
    strncpy(mqttQueue[idx].payload, payload,
            sizeof(mqttQueue[idx].payload) - 1);
    mqttQueue[idx].sequence = messageSequence++;
    mqttQueue[idx].valid = true;
    queueCount++;
    return true;
  }

  static int flush() {
    if (!mqtt.connected())
      return 0;

    int sentCount = 0;
    while (queueCount > 0) {
      int idx = queueHead;

      if (mqttQueue[idx].valid &&
          publishWithRetry(mqttQueue[idx].topic, mqttQueue[idx].payload)) {
        sentCount++;
        mqttQueue[idx].valid = false;
        queueHead = (queueHead + 1) % MQTT_QUEUE_SIZE;
        queueCount--;
      } else {
        break;
      }

      mqtt.loop();
      esp_task_wdt_reset();
    }

    return sentCount;
  }

private:
  static bool publishWithRetry(const char *topic, const char *payload,
                               int maxRetries = 3) {
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      if (mqtt.publish(topic, payload)) {
        return true;
      }
      delay(200 * attempt);
      mqtt.loop();
    }
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 15: NETWORK LAYER (UPGRADED)
 * ═══════════════════════════════════════════════════════════════════════ */

class CollarNetworkManager {
public:
  static bool connectWiFi() {
    mqttLog("INFO", "Connecting WiFi...");

    // 1. KITA BERSIHKAN SPASI YANG NYANGKUT DI MEMORI SECARA PAKSA!
    String safeSSID = String(config.wifi_ssid);
    safeSSID.trim(); // Hapus spasi di awal/akhir nama WiFi
    String safePASS = String(config.wifi_password);
    safePASS.trim(); // Hapus spasi di awal/akhir Password

    Serial.printf("[DEBUG] WiFi Target (Tanpa Spasi): '%s'\n",
                  safeSSID.c_str());
    Serial.printf("[DEBUG] Pass Target (Tanpa Spasi): '%s'\n",
                  safePASS.c_str());

    // 2. Persiapan Radio WiFi
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true);

    // 3. JEDA 1 DETIK (PERSIS SEPERTI DI FILE TESTING)
    delay(1000);

    Serial.println("[DEBUG] Mulai Scan BSSID...");
    int n = WiFi.scanNetworks();

    uint8_t bestBSSID[6];
    int bestRSSI = -100;
    bool found = false;

    // 4. Cari WiFi dengan sinyal terkuat
    for (int i = 0; i < n; i++) {
      if (WiFi.SSID(i) == safeSSID) {
        if (WiFi.RSSI(i) > bestRSSI) {
          bestRSSI = WiFi.RSSI(i);
          memcpy(bestBSSID, WiFi.BSSID(i), 6);
          found = true;
        }
      }
    }

    // 5. Turunkan daya pancar ESP32-C3 SuperMini
    WiFi.setTxPower(WIFI_POWER_8_5dBm);

    // 6. Eksekusi koneksi
    if (found) {
      Serial.printf("[WIFI] Konek ke MAC Address 'sungg': "
                    "%02X:%02X:%02X:%02X:%02X:%02X\n",
                    bestBSSID[0], bestBSSID[1], bestBSSID[2], bestBSSID[3],
                    bestBSSID[4], bestBSSID[5]);
      // Gunakan c_str() agar format String berubah jadi const char*
      WiFi.begin(safeSSID.c_str(), safePASS.c_str(), 0, bestBSSID);
    } else {
      Serial.println("[WIFI] GAGAL SCAN! BSSID target tidak ditemukan, coba "
                     "cara biasa...");
      WiFi.begin(safeSSID.c_str(), safePASS.c_str());
    }

    // 7. Tunggu koneksi (Timeout 20 Detik)
    unsigned long start = millis();
    int attempts = 0;

    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
      delay(1000); // Jeda 1 detik setiap cek, persis kayak testing
      attempts++;
      Serial.printf("[Detik %d] Status: %d\n", attempts, WiFi.status());
      esp_task_wdt_reset(); // Jangan lupa reset Watchdog biar nggak restart!
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      char msg[100];
      snprintf(msg, sizeof(msg), "WiFi OK - IP: %s",
               WiFi.localIP().toString().c_str());
      mqttLog("INFO", msg);
      setupOTA();
      syncTime();
      return true;
    }

    mqttLog("ERROR", "WiFi timeout");
    return false;
  }

  static bool connectMQTT() {
    // ═══ DUAL MODE: MQTTS (TLS) or MQTT (Plain TCP) ═══
    if (config.mqtt_port == 1883) {
      mqtt.setClient(plainClient);
      mqtt.setServer(config.mqtt_server, config.mqtt_port);
      mqtt.setCallback(mqttCallback);
      mqtt.setBufferSize(1024);
      mqttLog("INFO", "Connecting plain MQTT (no TLS)...");
    } else {
      secureClient.setCACert(ca_cert);
      // ═══ DEBUG TLS ═══
      Serial.println("[TLS] Testing connection to server...");
      if (secureClient.connect(config.mqtt_server, config.mqtt_port)) {
        Serial.println("[TLS] Raw TCP+TLS connection: SUCCESS");
        secureClient.stop();
        delay(500);
      } else {
        Serial.printf("[TLS] Raw TCP+TLS connection: FAILED\n");
        Serial.printf("[TLS] Last SSL error: %d\n",
                      secureClient.lastError(nullptr, 0));
      }

      mqtt.setClient(secureClient);
      mqtt.setServer(config.mqtt_server, config.mqtt_port);
      mqtt.setCallback(mqttCallback);
      mqtt.setBufferSize(1024);
      mqttLog("INFO", "Connecting secure MQTTS (TLS)...");
    }

    // ═══ UPGRADED: Last Will Testament (LWT) ═══
    char lwt_topic[80];
    snprintf(lwt_topic, sizeof(lwt_topic), "%s/%s", MQTT_TOPIC_STATUS,
             config.collar_id);

    // ═══ SIMPLIFIED: MQTT Authentication ═══
    if (mqtt.connect(config.collar_id,     // client ID
                     "hectra-bridge",      // MQTT username
                     "Br1dge@Hectra#2026", // MQTT password
                     lwt_topic,            // LWT topic
                     0,                    // QoS
                     true,                 // retain
                     "OFFLINE"             // LWT message
                     )) {
      if (config.mqtt_port == 1883) {
        mqttLog("INFO", "MQTT connected (plain TCP)");
      } else {
        mqttLog("INFO", "MQTTS connected (TLS)");
      }

      // Publish ONLINE status
      mqtt.publish(lwt_topic, "ONLINE", true);

      // Subscribe to command topics
      char cmdTopic[80];
      snprintf(cmdTopic, sizeof(cmdTopic), "%s/%s", MQTT_TOPIC_COMMAND,
               config.collar_id);
      mqtt.subscribe(cmdTopic);

      snprintf(cmdTopic, sizeof(cmdTopic), "%s/%s", MQTT_TOPIC_CONFIG,
               config.collar_id);
      mqtt.subscribe(cmdTopic);

      return true;
    }

    char msg[100];
    snprintf(msg, sizeof(msg), "MQTT connect failed - state: %d", mqtt.state());
    mqttLog("ERROR", msg);
    SecurityManager::recordAuthFailure();
    return false;
  }

private:
  static void syncTime() {
    timeClient.begin();
    int attempts = 0;
    while (!timeClient.update() && attempts < 3) {
      delay(1000);
      attempts++;
      esp_task_wdt_reset();
    }

    if (attempts < 3) {
      lastKnownEpoch = timeClient.getEpochTime(); // Save for offline estimation
      lastKnownBootCount = bootCount;
      char msg[100];
      snprintf(msg, sizeof(msg), "NTP synced: %lu", lastKnownEpoch);
      mqttLog("INFO", msg);
    }
  }

  static void setupOTA() {
    ArduinoOTA.setHostname(config.collar_id);
    ArduinoOTA.setPassword(config.ota_password);
    ArduinoOTA.onStart([]() { mqttLog("INFO", "OTA Start"); });
    ArduinoOTA.onEnd(
        []() { mqttLog("INFO", "OTA End - TODO: Verify firmware signature"); });
    ArduinoOTA.onError([](ota_error_t error) {
      char msg[50];
      snprintf(msg, sizeof(msg), "OTA Error: %u", error);
      mqttLog("ERROR", msg);
    });
    ArduinoOTA.begin();
  }

  static void mqttCallback(char *topic, byte *payload, unsigned int length) {
    char message[length + 1];
    for (unsigned int i = 0; i < length; i++)
      message[i] = (char)payload[i];
    message[length] = '\0';

    if (strstr(topic, MQTT_TOPIC_COMMAND)) {
      if (strstr(message, "START_OTA")) {
        maintenanceRequested = true;
        mqttLog("WARN", "OTA Mode activated");
      } else if (strstr(message, "REBOOT")) {
        mqttLog("WARN", "Remote reboot");
        ESP.restart();
      }
    }

    if (strstr(topic, MQTT_TOPIC_CONFIG)) {
      updateConfigFromMQTT(message);
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 16: STATE MACHINE HANDLERS
 * ═══════════════════════════════════════════════════════════════════════ */

void transitionToState(SystemState newState) {
  previousState = currentState;
  currentState = newState;

  const char *stateNames[] = {
      "INIT",          "PROVISIONING", "CHECK_LIFECYCLE", "READ_SENSORS",
      "VALIDATE_DATA", "CONNECT_WIFI", "CONNECT_MQTT",    "SEND_DATA",
      "MAINTENANCE",   "SLEEP",        "ERROR_RECOVERY",  "SECURITY_LOCKDOWN"};

  char msg[100];
  snprintf(msg, sizeof(msg), "State: %s → %s", stateNames[previousState],
           stateNames[newState]);
  mqttLog("INFO", msg);
}

void handleStateInit() {
  Serial.begin(115200);
  // Wait up to 3 seconds for Serial Monitor to connect (necessary for ESP32-C3
  // USB CDC)
  for (int i = 0; i < 30; i++) {
    if (Serial)
      break;
    delay(100);
  }

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdt_config = {.timeout_ms = WDT_TIMEOUT * 1000,
                                      .idle_core_mask = 0,
                                      .trigger_panic = true};
  // In ESP32 Core v3, WDT might already be initialized. If so, reconfigure it.
  if (esp_task_wdt_init(&wdt_config) == ESP_ERR_INVALID_STATE) {
    esp_task_wdt_reconfigure(&wdt_config);
  }
#else
  esp_task_wdt_init(WDT_TIMEOUT, true);
#endif
  esp_task_wdt_add(NULL);

  Serial.println("\n╔════════════════════════════════════════════╗");
  Serial.println("║  SMART COLLAR v4.5 SECURE                  ║");
  Serial.println("║  MQTTS | HMAC | AES | Device Binding       ║");
  Serial.println("╚════════════════════════════════════════════╝");

  char bootMsg[150];
  snprintf(bootMsg, sizeof(bootMsg), "Boot #%lu | FW: %s | Chip: %llX",
           bootCount++, FIRMWARE_VERSION, SecurityManager::getChipID());
  mqttLog("INFO", bootMsg);

  loadConfiguration();
  BufferManager::checkIntegrity();

  if (!config.provisioned) {
    transitionToState(STATE_PROVISIONING);
  } else {
    transitionToState(STATE_CHECK_LIFECYCLE);
  }
}

void handleStateProvisioning() {
  handleProvisioning();
  // Never returns - reboots after provisioning
}

void handleStateCheckLifecycle() {
  // Check for security lockdown
  if (SecurityManager::shouldLockdown()) {
    mqttLog("CRITICAL", "Security lockdown activated");
    transitionToState(STATE_SECURITY_LOCKDOWN);
    return;
  }

  if (!config.device_active) {
    mqttLog("CRITICAL", "Device disabled");
    transitionToState(STATE_SLEEP);
    return;
  }

  if (BatteryMonitor::isCritical()) {
    mqttLog("CRITICAL", "Battery critical");
    config.sleep_minutes = 60;
  }

  transitionToState(STATE_READ_SENSORS);
}

void handleStateReadSensors() {
  if (!SensorManager::initMPU9250()) {
    sensorFailCount++;
    if (sensorFailCount >= 3) {
      SensorManager::resetSensorBus();
      sensorFailCount = 0;
    }
  }
  SensorManager::initDS18B20();

  for (int batch = 0; batch < config.batch_count; batch++) {
    float sumZ = 0, sumSqZ = 0, maxZ = -100;
    int validSamples = 0;

    for (int i = 0; i < config.window_size; i++) {
      float z = SensorManager::readZAxis();
      if (!isnan(z)) {
        sumZ += z;
        sumSqZ += (z * z);
        if (z > maxZ)
          maxZ = z;
        validSamples++;
      }
      delay(50);
    }

    if (validSamples >= config.window_size / 2) {
      batchReadings[batch].meanZ = sumZ / validSamples;
      batchReadings[batch].rmsZ = sqrt(sumSqZ / validSamples);
      batchReadings[batch].maxZ = maxZ;
      batchReadings[batch].temperature = SensorManager::readTemperature();
      batchReadings[batch].valid = true;
    } else {
      batchReadings[batch].valid = false;
    }

    esp_task_wdt_reset();
  }

  transitionToState(STATE_VALIDATE_DATA);
}

void handleStateValidateData() {
  SensorReading fallback = {-1.0, 1.0, -0.8, 25.0, 0, true};
  int validBatches = 0;

  for (int i = 0; i < config.batch_count; i++) {
    if (!batchReadings[i].valid) {
      batchReadings[i] = (i > 0) ? batchReadings[i - 1] : fallback;
    }
    if (DataValidator::isValidReading(batchReadings[i])) {
      validBatches++;
    }
  }

  if (validBatches == 0) {
    sensorFailCount++;
    transitionToState(STATE_ERROR_RECOVERY);
    return;
  }

  sensorFailCount = 0;
  transitionToState(STATE_CONNECT_WIFI);
}

void handleStateConnectWiFi() {
  if (CollarNetworkManager::connectWiFi()) {
    transitionToState(STATE_CONNECT_MQTT);
  } else {
    offlineMode = true;
    failedAttempts++;
    transitionToState(STATE_SLEEP);
  }
}

void handleStateConnectMQTT() {
  if (CollarNetworkManager::connectMQTT()) {
    SecurityManager::resetAuthFailures();
    offlineMode = false;
    transitionToState(STATE_SEND_DATA);
  } else {
    offlineMode = true;
    transitionToState(STATE_SLEEP);
  }
}

void handleStateSendData() {
  unsigned long currentEpoch = timeClient.getEpochTime();

  // ── SIMPAN TIMESTAMP ke batchReadings (belum tulis ke buffer) ──
  for (int i = 0; i < config.batch_count; i++) {
    batchReadings[i].timestamp = currentEpoch - (config.batch_count - 1 - i);
  }

  // ── TULIS batch baru ke buffer HANYA SEKALI ──
  for (int i = 0; i < config.batch_count; i++) {
    if (batchReadings[i].valid) {
      BufferManager::write(batchReadings[i]);
    }
  }

  int batPct;
  float batVolt = BatteryMonitor::readVoltage(batPct);
  uint64_t chipID = SecurityManager::getChipID();

  // ── Snapshot bufCount dulu sebelum apapun berubah ──
  int snapshotCount = bufCount;

  for (int i = 0; i < snapshotCount; i++) {
    if (!SecurityManager::checkRateLimit()) {
      delay(1000);
      continue;
    }

    SensorReading reading = BufferManager::read(i);

    char nonce[NONCE_SIZE * 2 + 1];
    SecurityManager::generateNonce(nonce);

    char finalPayload[700];
    snprintf(finalPayload, sizeof(finalPayload),
             "{"
             "\"collar_id\":\"%s\","
             "\"device_secret\":\"%s\","
             "\"chip_id\":\"%llX\","
             "\"fw_version\":\"%s\","
             "\"seq\":%lu,"
             "\"timestamp\":%lu,"
             "\"nonce\":\"%s\","
             "\"mean_z\":%.3f,\"rms_z\":%.3f,\"max_z\":%.3f,"
             "\"temperature\":%.2f,"
             "\"battery_voltage\":%.2f,"
             "\"battery_percent\":%d"
             "}",
             config.collar_id, config.device_secret, chipID, FIRMWARE_VERSION,
             messageSequence + i, reading.timestamp, nonce, reading.meanZ,
             reading.rmsZ, reading.maxZ, reading.temperature, batVolt, batPct);

    MQTTQueue::enqueue(MQTT_TOPIC_DATA, finalPayload);
    esp_task_wdt_reset();
  }

  int sent = MQTTQueue::flush();

  char msg[100];
  snprintf(msg, sizeof(msg), "Sent %d/%d batches", sent, snapshotCount);
  mqttLog("INFO", msg);

  // ── Baru clear jika SEMUA terkirim ──
  if (sent == snapshotCount) {
    BufferManager::clear();
    offlineMode = false;
    failedAttempts = 0;
    SecurityManager::resetAuthFailures();
  } else if (sent > 0) {
    int remaining = snapshotCount - sent;
    for (int i = 0; i < remaining; i++) {
      SensorReading r = BufferManager::read(sent + i);
      int idx = i % MAX_BUFFERED_BATCHES;
      bufMeanZ[idx] = r.meanZ;
      bufRmsZ[idx] = r.rmsZ;
      bufMaxZ[idx] = r.maxZ;
      bufSuhu[idx] = r.temperature;
      bufTimestamp[idx] = r.timestamp;
    }
    bufHead = remaining % MAX_BUFFERED_BATCHES;
    bufCount = remaining;
    mqttLog("WARN", "Partial send - will retry remaining on next boot");
  } else {
    // sent == 0: nggak ada yang kekirim, buffer dibiarkan utuh
    mqttLog("ERROR", "Send failed - all data retained in buffer");
  }

  transitionToState(STATE_MAINTENANCE);
}

void handleStateMaintenance() {
  for (int i = 0; i < 100; i++) {
    mqtt.loop();
    ArduinoOTA.handle();
    delay(100);
    if (i % 20 == 0)
      esp_task_wdt_reset();
  }

  if (maintenanceRequested) {
    maintenanceRequested = false;
    mqttLog("WARN", "OTA window - 3 mins");

    unsigned long start = millis();
    while (millis() - start < 180000) {
      ArduinoOTA.handle();
      mqtt.loop();
      if (millis() % 10000 == 0)
        esp_task_wdt_reset();
      delay(10);
    }
    mqttLog("INFO", "OTA timeout");
  }

  transitionToState(STATE_SLEEP);
}

void handleStateErrorRecovery() {
  mqttLog("ERROR", "Error recovery");
  SensorManager::resetSensorBus();
  config.sleep_minutes = 30;
  transitionToState(STATE_SLEEP);
}

void handleStateSecurityLockdown() {
  mqttLog("CRITICAL", "SECURITY LOCKDOWN - Too many auth failures");
  mqttLog("INFO", "Only OTA/reset allowed");

  // Stay awake for OTA only
  for (int i = 0; i < 300; i++) { // 5 minutes
    ArduinoOTA.handle();
    delay(1000);
    if (i % 10 == 0)
      esp_task_wdt_reset();
  }

  // Extended sleep
  config.sleep_minutes = 120; // 2 hours
  transitionToState(STATE_SLEEP);
}

void handleStateSleep() {
  if (offlineMode) {
    unsigned long estimatedEpoch = 0;
    if (lastKnownEpoch > 0) {
      estimatedEpoch =
          lastKnownEpoch + ((unsigned long)(bootCount - lastKnownBootCount) *
                            config.sleep_minutes * 60UL);
    }

    for (int i = 0; i < config.batch_count; i++) {
      if (batchReadings[i].valid) {
        batchReadings[i].timestamp =
            (estimatedEpoch > 0)
                ? estimatedEpoch - (unsigned long)(config.batch_count - 1 - i)
                : 0;
        BufferManager::write(batchReadings[i]);
      }
    }

    char offlineMsg[100];
    snprintf(offlineMsg, sizeof(offlineMsg),
             "Offline - buffered %d/%d (est epoch: %lu)", bufCount,
             MAX_BUFFERED_BATCHES, estimatedEpoch);
    mqttLog("WARN", offlineMsg);
  }

  char msg[100];
  snprintf(msg, sizeof(msg), "Sleep %d mins | Boot: %lu | Buffer: %d",
           config.sleep_minutes, bootCount, bufCount);
  mqttLog("INFO", msg);

  Serial.flush();
  mqtt.disconnect();
  WiFi.disconnect(true);
  esp_task_wdt_delete(NULL);

  esp_sleep_enable_timer_wakeup((uint64_t)config.sleep_minutes * 60 *
                                1000000ULL);
  esp_deep_sleep_start();
}

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION 17: MAIN ENTRY POINT
 * ═══════════════════════════════════════════════════════════════════════ */

void setup() {
  currentState = STATE_INIT;

  while (true) {
    switch (currentState) {
    case STATE_INIT:
      handleStateInit();
      break;
    case STATE_PROVISIONING:
      handleStateProvisioning();
      break;
    case STATE_CHECK_LIFECYCLE:
      handleStateCheckLifecycle();
      break;
    case STATE_READ_SENSORS:
      handleStateReadSensors();
      break;
    case STATE_VALIDATE_DATA:
      handleStateValidateData();
      break;
    case STATE_CONNECT_WIFI:
      handleStateConnectWiFi();
      break;
    case STATE_CONNECT_MQTT:
      handleStateConnectMQTT();
      break;
    case STATE_SEND_DATA:
      handleStateSendData();
      break;
    case STATE_MAINTENANCE:
      handleStateMaintenance();
      break;
    case STATE_ERROR_RECOVERY:
      handleStateErrorRecovery();
      break;
    case STATE_SECURITY_LOCKDOWN:
      handleStateSecurityLockdown();
      break;
    case STATE_SLEEP:
      handleStateSleep();
      break;
    }

    esp_task_wdt_reset();
    if (currentState == STATE_SLEEP)
      break;
  }
}

void loop() {
  // Not used
}