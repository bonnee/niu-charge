// We need this to build our post string
var http = require('https');
const TuyAPI = require('tuyapi');
var express = require('express');
const config = require('config');
const storage = require('node-persist');

const scooter = config.get('scooter');
const plug = config.get('plug');

storage.init( /* options ... */ );

var limit = 90;

getLimit().then(l => {
	limit = l;
})

var app = express();

const device = new TuyAPI({
	id: plug.id,
	key: plug.key
});

app.use(express.static('public'));
app.use(express.urlencoded())
app.set('view engine', 'pug');

app.get('/', function (req, res) {

	updateState().then((data) => {
		device.get({
			schema: true
		}).then(plugData => {
			plugData = plugData.dps

			res.render('index', {
				data: data,
				soc: getSOC(data),
				plugData: {
					state: plugData['1'],
					current: (plugData['4'] / 1000).toFixed(2),
					power: Math.round(plugData['5'] / 10),
					volt: Math.round(plugData['6'] / 10)
				},
				chargeLimit: limit
			});
		});
	});
});

app.post('/charging', (req, res) => {
	console.log(req.body.value == "true");

	device.set({
		dps: 1,
		set: (req.body.value == "true")
	}).then(() => {
		console.log("done");
		res.statusCode = 200;
		res.send();
	}).catch(() => {
		res.statusCode = 500;
		res.send();
	})
});

app.post('/setlimit', (req, res) => {
	setLimit(req.body.value);

	res.statusCode = 200;
	res.send();
});

connectPlug();
setChargingInterval();

var interval;

// Update every 5 minutes until the charge begins
function setIdleInterval() {
	interval = setInterval(() => {
		updateState().then((data) => {
			if (data.isCharging) {
				console.log("NIU is charging, decreasing interval");

				clearInterval(interval);
				setChargingInterval();
			}
		});
	}, 300000);
};

function setChargingInterval() {
	interval = setInterval(() => {
		updateState().then((data) => {

			console.log("Checking NIU", getSOC(data), "%")
			if (data.isCharging) {
				if (getSOC(data) >= limit) {
					console.log("Stopping charge")
					setPlug(false);

					// Going back to 5min interval
					clearInterval(interval);
					setIdleInterval();
				}
			} else {
				clearInterval(interval);
				setIdleInterval();
			}
		});
	}, 60000);
};

function getSOC(data) {
	let battery = [data.batteries.compartmentA.batteryCharging, data.batteries.compartmentB.batteryCharging]

	if (limit == 100) {
		return Math.min(battery[0], battery[1]);
	}
	return Math.round((battery[0] + battery[1]) / 2)
}

async function getLimit() {
	return await storage.get('chargeLimit');
}

async function setLimit(newLimit) {
	await storage.set('chargeLimit', parseInt(newLimit));

	getLimit().then((l) => {
		limit = l;
	});

}

function setPlug(turn_on) {
	device.set({
		set: turn_on
	}).then((data) => {
		console.log(data)
	})
}

function connectPlug() {
	let stateHasChanged = false;

	// Find device on network
	device.find().then(() => {
		// Connect to device
		device.connect();

	});

	// Add event listeners
	device.on('connected', () => {
		device.get({
			schema: true
		}).then((dat) => {
			console.log(dat)
			/*4: mA
			5: W
			6: V*/
		})
		console.log('Connected to device!');
	});

	device.on('disconnected', () => {
		console.log('Disconnected from device.');
	});

	device.on('error', error => {
		console.log('Error!', error);
	});

}

function updateState() {
	return new Promise((accept, reject) => {
		var post_options = {
			host: 'app-api-fk.niu.com',
			path: '/v3/motor_data/index_info?sn=' + scooter.sn,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'token': scooter.token
			}
		};

		// Set up the request
		var post_req = http.request(post_options, function (res) {
			res.setEncoding('utf8');
			res.on('data', function (chunk) {

				accept(JSON.parse(chunk).data);

			});
		});

		post_req.end();
	})
}

app.listen(3000, function () {
	console.log('Example app listening on port 3000!');
});