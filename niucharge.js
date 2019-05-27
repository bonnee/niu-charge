// We need this to build our post string
var http = require('https');
const TuyAPI = require('tuyapi');
var express = require('express');
const bodyParser = require('body-parser');
const config = require('config');
const storage = require('node-persist');

const scooter = config.get('scooter');
const plug = config.get('plug');

storage.init();

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
app.use(bodyParser.urlencoded({
	extended: true
}));

app.set('view engine', 'pug');

app.get('/', function (req, res) {
	handlePromises().then(data => {
		if (data[0] instanceof Error) {
			res.statusCode(500).send();
			return;
		}

		let plugData = {
			state: -1,
			current: -1,
			power: -1,
			volt: -1,
		};

		if (!(data[1] instanceof Error)) {
			plugData = {
				state: data[1].dps['1'],
				current: (data[1].dps['4'] / 1000).toFixed(2),
				power: Math.round(data[1].dps['5'] / 10),
				volt: Math.round(data[1].dps['6'] / 10)
			}
		}

		res.render('index', {
			data: data[0],
			soc: getSOC(data[0]),
			plugData,
			chargeLimit: limit
		});
	});
});

async function handlePromises() {
	let promises = [updateState(), device.get({
		schema: true
	})];

	return await Promise.all(promises.map(p => p.catch(e => e)));
}

app.post('/charging', (req, res) => {
	device.set({
		dps: 1,
		set: (req.body.value == "true")
	}).then(() => {
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

			console.log("Checking SOC", getSOC(data), "%")
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

async function setPlug(turn_on) {
	await device.set({
		set: turn_on
	});
}

function connectPlug() {
	// Find device on network
	device.find().then(() => {
		// Connect to device
		device.connect();
	}).catch((e) => {
		console.error("Error finding plug, retrying", e);
		connectPlug();
	});
}

// Add event listeners
device.on('connected', () => {
	console.log('Connected to plug!');
});

device.on('disconnected', () => {
	console.log('Disconnected from plug. Reconnecting...');
	connectPlug();
});

device.on('error', error => {
	console.log('Elug error!', error);
});

function updateState() {
	return new Promise((resolve, reject) => {
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

				resolve(JSON.parse(chunk).data);

			});
		});

		post_req.end();
	})
}

app.listen(process.env.PORT || 3000, function () {
	console.log('NIU Charge started!');
});