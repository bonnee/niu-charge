# niu-charge
## Charging manager for [NIU](https://www.niu.com) electric mopeds
This project monitors the charging process of a NIU scooter and shuts down the charger using a tuya smart plug when the SOC reaches a threshold.

Only dual battery models are supported right now.

# Setup
## NIU API
In order to check the SOC of the battery, the serial number of the moped and a token are required.
The easiest way to obtain the token is by capturing the packets from the NIU app (using Wireshark or some random packet capture app) and extracting the `token` field in the HTTP header.

## Tuya Protocol
This project is set to work with Tuya compatible products, but can be made to work with any protocol.
The [tuyapi](https://github.com/codetheweb/tuyapi) library is used to comunicate directly with the plug.
Follow [this](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) tutorial to get the plug's `id` and `key`.