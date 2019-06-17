# niu-charge
## Charging manager for [NIU](https://www.niu.com) electric scooters
![Charging](/charging.jpg)
With niu-charge you can control when to start or stop charging your NIU electric scooter.
In order to preserve the battery, you can set a maximum charging percentage and this software will automatically stop charging when this limit is reached.

# Setup
## What you need
- A cloud-connected NIU electric scooter;
- A ~15€ WiFi smart plug compatible with the [Tuya cloud](tuya.com) (just search Amazon for `tuya smart plug`). WARNING: Some plugs might not work with this setup as they can use different versions of the communication protocol.
- A computer to run this server on. If you don't have one, a 35€ [Raspberry Pi](https://www.raspberrypi.org/) will do the job just fine.

## How to set it up
Just connect the NIU charger into the smart plug and connect the plug into the wall.
Both the smart plug and the computer you will run this software on must be on the same network.
To configure the server, rename `config/example.json` into `config/default.json` and then edit it with your parameters.

### Configuring the NIU cloud (See [niu-app-api](https://github.com/Bonnee/niu-app-api) for further technical details)
In order to log in the NIU cloud to check the SoC of the battery, the serial number of the scooter and an authentication token are required. Currently this project doesn't include a login page, so the easiest way to obtain the token is by capturing the packets from the NIU App (using Wireshark or some mobile [packet capture](https://play.google.com/store/apps/details?id=app.greyshirts.sslcapture&hl=it) app) and extracting the `token` field from the HTTP header.

### Configuring the Tuya protocol
This project is set to work with Tuya compatible products, but can be made to work with any protocol.
The [tuyapi](https://github.com/codetheweb/tuyapi) library is used to comunicate with the plug over LAN.
Follow [this](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md) tutorial to get the plug's `id` and `key`.

Feel free to contact me on [Telegram](https://t.me/Bonny) if you need help or have any questions.