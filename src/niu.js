var https = require('https');

module.exports = class Niu {
	constructor({
		sn,
		token
	}) {
		this.sn = sn
		this.token = token;
		this._data;
	}

	static computeSOC(data) {
		let battery = [data.batteries.compartmentA.batteryCharging, data.batteries.compartmentB.batteryCharging]

		return (battery[0] + battery[1]) / 2
	}

	get() {
		return this._data;
	}

	update() {
		let self = this;
		return new Promise((resolve, reject) => {
			var post_options = {
				host: 'app-api-fk.niu.com',
				path: '/v3/motor_data/index_info?sn=' + this.sn,
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'token': this.token
				}
			};

			// Set up the request
			var post_req = https.request(post_options, res => {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					self._data = JSON.parse(chunk).data
					self._data.soc = Niu.computeSOC(self._data);

					resolve(self._data);
				});
			});

			post_req.end();
		});
	}
}