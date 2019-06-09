// We need this to build our post string
const bodyParser = require('body-parser');
const config = require('config');
const express = require('express');

const Scooter = require('./src/niu');
const Plug = require('./src/plug');
const Limit = require('./src/limit');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var interval = {
	state: 0,
	id: 0
};

var scooter = new Scooter(config.get('scooter'));
var plug = new Plug(config.get('plug'));
var limit = new Limit();
limit.load();

plug.connect();
scooter.update();

plug.on('connected', async () => {
	plug.update().then(data => {
		io.emit('plug', data);
	});
});

plug.on('data', data => {
	if (!interval.state && data.state) {
		setChargingInterval();
	}

	io.emit('plug', data);
});

io.on('connection', function (socket) {
	socket.on('ready', () => {
		sendData();
	});

	socket.on('limit', async (msg) => {
		await limit.set(msg);
		io.emit("limit", msg);
	});

	socket.on('plug', async msg => {
		await plug.set(msg)

		io.emit('plug', plug.get());
	});
});

function sendData() {
	io.emit('data', {
		limit: limit.get(),
		scooter: scooter.get(),
		plug: plug.get()
	});
}

setChargingInterval();

// Update every 5 minutes until the charge begins
function setIdleInterval() {
	console.log('Setting IDLE interval');

	clearInterval(interval.id);
	interval.state = 0;
	interval.id = setInterval(async () => {
		await scooter.update();
		sendData();

		if (scooter.get().isCharging) {
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
		await scooter.update();
		sendData();

		console.log("Checking SOC", scooter.get().soc, "%");

		if (scooter.get().isCharging || plug.get().state) {
			if (scooter.get().soc > await limit.get()) {
				console.log("Stopping charge");
				plug.set(false);
			}
		} else {
			setIdleInterval();
		}

	}, 30000); //30sec
};

app.use(express.static('public'));
app.use(bodyParser.urlencoded({
	extended: true
}));

app.set('view engine', 'pug');

app.get('/', function (req, res) {
	res.render('index');
});

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
	limit.set(req.body.value);

	res.statusCode = 200;
	res.send();
});

http.listen(process.env.PORT || 3000, () => {
	console.log('NIU Charge started!');
});