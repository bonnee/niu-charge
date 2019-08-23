var https = require('https');

module.exports = class Scooter {
	constructor(sn) {
		this.sn = sn
		this.data;
	}

	static computeSOC(data) {
		let soc = 0;

		if (data.batteries.compartmentB instanceof Object) {
			let battery = [data.batteries.compartmentA, data.batteries.compartmentB];

			if (battery[0].isConnected) {
				soc += battery[0].batteryCharging;
			}
			if (battery[1].isConnected) {
				soc += battery[1].batteryCharging;
			}

			if (battery[0].isConnected && battery[1].isConnected) {
				return soc / 2;
			}
		} else {
			if (data.batteries.compartmentA.isConnected) {
				soc = data.batteries.compartmentA.batteryCharging;
			}
		}
		return soc;
	}

	get() {
		return this.data;
	}
}