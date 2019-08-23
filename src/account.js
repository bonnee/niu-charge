var https = require('https');
var querystring = require('querystring');

const Scooter = require('./niu');

module.exports = class Account {
	constructor({
		serial,
		token
	}) {
		this.logged = false;
		this.scooter = new Scooter(serial);

		if (token === undefined) {
			token = 'tokenExperienceMode'
		} else {
			this.logged = true;
		}

		this.token = token;
	}

	isLogged() {
		return this.logged;
	}

	login(username, password) {
		let self = this;

		return new Promise((resolve, reject) => {

			var postData = querystring.stringify({
				'account': username,
				'password': password
			});

			var post_options = {
				host: 'account-fk.niu.com',
				path: '/appv2/login',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': postData.length
				}
			};

			// Set up the request
			var post_req = https.request(post_options, res => {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					try {
						chunk = JSON.parse(chunk)

						if (chunk.status == 0) {
							self.token = chunk.data.token;
							self.logged = true;

							resolve(self.token);
						} else {
							reject(chunk.status);
						}
					} catch (e) {
						console.error('Unable to parse message.', e);
						reject(e);
					}
				});
			});

			post_req.write(postData);
			post_req.end();
		});
	}

	getScooter() {
		return this.scooter.data;
	}

	updateScooter() {
		let self = this;

		return new Promise((resolve, reject) => {
			var post_options = {
				host: 'app-api-fk.niu.com',
				path: '/v3/motor_data/index_info?sn=' + this.scooter.sn,
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
					try {
						self.scooter.data = JSON.parse(chunk).data;
						self.scooter.data.soc = Scooter.computeSOC(self.scooter.data);

						resolve(self.getScooter());
					} catch (e) {
						console.error('Unable to parse message.', e);
						reject(e);
					}
				});
			});

			post_req.end();
		});
	}
}