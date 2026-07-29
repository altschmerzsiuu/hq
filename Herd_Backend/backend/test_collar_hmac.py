import hmac
import hashlib
import time
import json
import psycopg2
import os
import paho.mqtt.client as mqtt

# Config matching docker environment
MQTT_HOST = "mqtt"
MQTT_PORT = 1883
TOPIC = "kandang/sensor"
COLLAR_ID = "SAPI_A01"
DEVICE_SECRET = "Kp92!Dq_7XkL0@v"

DB_CONFIG = {
    "host": os.getenv('DB_HOST', 'db'),
    "port": int(os.getenv('DB_PORT', 5432)),
    "database": os.getenv('DB_NAME', 'Collar_to_Gateway'),
    "user": os.getenv('DB_USER', 'postgres'),
    "password": os.getenv('DB_PASSWORD', 'postgre')
}

def compute_hmac_payload():
    # Construct base payload matching ESP32 firmware snprintf format precisely
    # Note that ESP32 formats floats to certain decimal places
    # mean_z: %.3f, rms_z: %.3f, max_z: %.3f, temperature: %.2f, battery_voltage: %.2f
    epoch_time = int(time.time())
    nonce = "a1b2c3d4e5f6"
    chip_id = "3C61051515E0"
    fw_version = "4.5.0"
    seq = 1
    
    mean_z = 0.051
    rms_z = 0.124
    max_z = 0.352
    temp = 37.85
    bat_volt = 4.12
    bat_pct = 98

    # The payload without closing brace
    payload = (
        f'{{"collar_id":"{COLLAR_ID}",'
        f'"chip_id":"{chip_id}",'
        f'"fw_version":"{fw_version}",'
        f'"seq":{seq},'
        f'"timestamp":{epoch_time},'
        f'"nonce":"{nonce}",'
        f'"mean_z":{mean_z:.3f},'
        f'"rms_z":{rms_z:.3f},'
        f'"max_z":{max_z:.3f},'
        f'"temperature":{temp:.2f},'
        f'"battery_voltage":{bat_volt:.2f},'
        f'"battery_percent":{bat_pct}'
    )
    
    # Compute signature
    signature = hmac.new(
        DEVICE_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Form final JSON
    final_payload = payload + f',\"auth\":\"{signature}\"}}'
    return final_payload

def check_db():
    print("Checking database for latest sensor data...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT id, collar_id, mean_z, rms_z, max_z, temperature, battery_percent, batch_ts FROM sensor_data ORDER BY id DESC LIMIT 5;")
        rows = cur.fetchall()
        print("\n--- LATEST SENSOR_DATA RECORDS ---")
        for row in rows:
            print(f"ID: {row[0]} | Collar: {row[1]} | MeanZ: {row[2]} | RmsZ: {row[3]} | MaxZ: {row[4]} | Temp: {row[5]} | Bat: {row[6]}% | TS: {row[7]}")
        print("----------------------------------\n")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ DB Check Error: {e}")

def main():
    payload = compute_hmac_payload()
    print(f"Prepared Payload:\n{payload}\n")
    
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    print("Connecting to local MQTT Broker...")
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    
    # Start loop
    client.loop_start()
    
    print(f"Publishing to topic: {TOPIC}")
    info = client.publish(TOPIC, payload)
    info.wait_for_publish()
    print("Publish status: sent successfully")
    
    client.loop_stop()
    client.disconnect()
    
    # Wait for bridge processing
    print("Waiting 3 seconds for MQTT bridge to process...")
    time.sleep(3)
    
    check_db()

if __name__ == "__main__":
    main()
