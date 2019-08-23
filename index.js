// We need this to build our post string
const bodyParser = require('body-parser');
const config = require('config');
const express = require('express');
const fs = require('fs');

const TOKEN_NAME = 'config/token';

const Account = require('./src/account.js');
const Plug = require('./src/plug');
const Limit = require('./src/limit');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var interval = {
	state: 0,
	id: 0
};

var account;
if (fs.existsSync(TOKEN_NAME)) {
	let token = fs.readFileSync(TOKEN_NAME);
	if (token != '') {
		account = new Account({
			serial: config.get('scooter'),
			token: token.toString()
		});
		account.updateScooter();
	}
} else {
	account = new Account({
		serial: config.get('scooter')
	});
}

var plug = new Plug(config.get('plug'));
var limit = new Limit();
limit.load();

plug.connect();

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
		scooter: account.getScooter(),
		plug: plug.get()
	});
}

setChargingInterval();

// Update every 30 minutes until the charge begins
function setIdleInterval() {
	console.log('Setting IDLE interval');

	clearInterval(interval.id);
	interval.state = 0;
	interval.id = setInterval(async () => {
		await account.updateScooter();
		sendData();

		if (account.getScooter().isCharging) {
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
		await account.updateScooter();
		sendData();

		console.log("Checking SOC", account.getScooter().soc, "%");

		if (account.getScooter().isCharging || plug.get().state) {

			let lim = await limit.get();
			if (account.getScooter().soc >= lim && lim < 100) {

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
	if (account.isLogged()) {
		res.render('index');
	} else {
		res.redirect('/login');
	}
});

app.get('/login', (req, res) => {
	if (account.isLogged()) {
		res.redirect('/');
	} else {
		res.render('login');
	}
});

app.post('/login', (req, res) => {
	account.login(req.body.username, req.body.password).then(token => {
		console.log("User logged in!")

		require('fs').writeFile(TOKEN_NAME, token, () => {});

		account = new Account({
			serial: config.get('scooter'),
			token: token
		});
		account.updateScooter().then(() => {
			res.redirect('/');
		});

	}).catch(e => {
		res.send("error: " + e);
	});
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

http.listen(process.env.PORT || 3000, () => {
	console.log('NIU Charge started!');
});