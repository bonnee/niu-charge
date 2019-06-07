const TuyAPI = require('tuyapi');
const EventEmitter = require('events');

module.exports = class Plug extends EventEmitter {
	constructor({
		id,
		key
	}) {
		super();

		this._data = {
			state: -1,
			current: -1,
			power: -1,
			volt: -1
		}

		this.plug = new TuyAPI({
			id: id,
			key: key
		});

		this.plug.on('connected', () => {
			this.emit('connected');
		});

		this.plug.on('disconnected', () => {
			this.emit('disconnected');

			this.connect();
		});

		this.plug.on('error', error => {
			this.emit('error', error);
		});

		this.plug.on('data', plug => {
			this.parse(plug);

			this.emit('data', this._data);
		});
	}

	connect(repeat = true) {
		this.plug.find().then(() => {

			this.plug.connect();

		}).catch((e) => {

			console.error("Error finding plug");

			if (repeat) {
				console.error("Retrying");
				this.connect();
			}
		});
	}

	get() {
		return this._data;
	}

	async update() {
		let plug = await this.plug.get({
			schema: true
		});

		return this.parse(plug);
	}

	async set(state) {
		await this.plug.set({
			set: state
		});
	}

	parse(plug) {
		if (typeof plug.dps !== 'undefined') {
			plug = plug.dps;

			if (typeof plug['1'] != "undefined")
				this._data.state = plug['1']

			if (typeof plug['4'] != "undefined")
				this._data.current = (plug['4'] / 1000).toFixed(2)

			if (typeof plug['5'] != "undefined")
				this._data.power = Math.round(plug['5'] / 10)

			if (typeof plug['6'] != "undefined")
				this._data.volt = Math.round(plug['6'] / 10)
		}
	}
}