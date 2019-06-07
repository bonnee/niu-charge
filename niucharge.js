// We need this to build our post string
var https = require('https');
const TuyAPI = require('tuyapi');
const bodyParser = require('body-parser');
const config = require('config');
const storage = require('node-persist');
const express = require('express');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const scooter = config.get('scooter');
const plug = config.get('plug');

var data = {
	limit: 90,
	plug: {
		state: -1,
		current: -1,
		power: -1,
		volt: -1,
	}
};

storage.init();

getLimit().then(lim => {
	data.limit = lim;
});

const device = new TuyAPI({
	id: plug.id,
	key: plug.key
});

io.on('connection', function (socket) {
	socket.on('ready', () => {
		socket.emit('data', data);
	});

	socket.on('disconnect', function () {});

	socket.on('limit', async (msg) => {
		await setLimit(msg);
		io.emit("limit", msg);
	});

	socket.on('plug', async msg => {
		await setPlug(msg);

		io.emit('plug', plug);
	});
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({
	extended: true
}));

app.set('view engine', 'pug');

app.get('/', function (req, res) {
	res.render('index');
});

async function handlePromises() {
	let promises = [updateScooter(), getPlug()];

	await Promise.all(promises.map(p => p.catch(e => e)));

	io.emit('data', data);
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

var interval = {
	state: 0,
	id: 0
};

setChargingInterval();

// Update every 5 minutes until the charge begins
function setIdleInterval() {
	console.log('Setting IDLE interval');

	clearInterval(interval.id);
	interval.state = 0;
	interval.id = setInterval(async () => {
		await updateScooter();

		if (data.scooter.isCharging) {
			console.log("NIU is charging, decreasing interval");

			setChargingInterval();
		}

	}, 300000); //30min
};

function setChargingInterval() {
	console.log('Setting CHARGING interval');

	clearInterval(interval.id);
	interval.state = 1;
	interval.id = setInterval(async () => {
		await updateScooter();

		console.log("Checking SOC", data.scooter.soc, "%")
		if (data.scooter.isCharging || data.plug.state) {
			if (data.scooter.soc > data.limit) {
				console.log("Stopping charge")
				setPlug(false);
			}
		} else {
			setIdleInterval();
		}

	}, 30000); //30sec
};

function getSOC(scooter) {
	let battery = [scooter.batteries.compartmentA.batteryCharging, scooter.batteries.compartmentB.batteryCharging]

	return (battery[0] + battery[1]) / 2
}

async function getLimit() {
	return await storage.get('chargeLimit');
}

async function setLimit(newLimit) {
	await storage.set('chargeLimit', parseInt(newLimit));

	data.limit = await getLimit();
}

async function getPlug() {
	let plug = await device.get({
		schema: true
	});
}

function parsePlug(plug) {
	if (typeof plug.dps !== 'undefined') {
		plug = plug.dps;

		if (typeof plug['1'] != "undefined")
			data.plug.state = plug['1']

		if (typeof plug['4'] != "undefined")
			data.plug.current = (plug['4'] / 1000).toFixed(2)

		if (typeof plug['5'] != "undefined")
			data.plug.power = Math.round(plug['5'] / 10)

		if (typeof plug['6'] != "undefined")
			data.plug.volt = Math.round(plug['6'] / 10)

		if (!interval.state && data.plug.state) {
			setChargingInterval();
		}
	}
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
		console.error("Error finding plug, retrying");
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

device.on('data', plug => {
	parsePlug(plug);

	io.emit('plug', data.plug);
});

function updateScooter() {
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
		var post_req = https.request(post_options, function (res) {
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				data.scooter = JSON.parse(chunk).data
				data.scooter.soc = getSOC(data.scooter);

				io.emit('data', data);
				resolve();
			});
		});

		post_req.end();
	})
}
handlePromises();

http.listen(process.env.PORT || 3000, function () {
	console.log('NIU Charge started!');
});