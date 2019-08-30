// We need this to build our post string
const bodyParser = require('body-parser');
const config = require('config');
const express = require('express');
const fs = require('fs');

const TOKEN_NAME = 'config/token';

const Account = require('./src/account.js');
const Plug = require('./src/plug');
const Limit = require('./src/limit');
const History = require('./src/history');

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

var history = new History();
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
		history.start(account.getScooter().soc, plug.get().power);
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

			history.start(account.getScooter().soc, plug.get().power);

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

		if (account.getScooter().isCharging) {
			if (plug.get().state) {
				if (history.get().length == 0) {
					history.start(account.getScooter().soc, plug.get().power);
				} else {
					history.update(account.getScooter().soc, plug.get().power);
				}

				let lim = await limit.get();
				if (account.getScooter().soc > lim && lim < 100) {

					console.log("Stopping charge");
					plug.set(false);
				}
			}
		} else {
			setIdleInterval();
		}

	}, 30000); //30sec
};

function checkLogged(req, res, next) {
	if (account.isLogged()) {
		next();
	} else {
		res.redirect('/login');
	}
}

app.use(express.static('public'));
app.use(bodyParser.urlencoded({
	extended: true
}));

app.set('view engine', 'pug');

app.get('/', checkLogged, (req, res) => {
	res.render('index');
});

app.get('/login', (req, res) => {
	if (account.isLogged()) {
		res.redirect('/');
	} else {
		res.render('login');
	}
});

app.get('/history', checkLogged, (req, res) => {
	let hist = history.get();

	res.render('history', {
		data: hist[hist.length - 1]
	});
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