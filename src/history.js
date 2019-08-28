const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('history.json')
const db = low(adapter)

module.exports = class History {
	constructor() {
		db.defaults({
			data: []
		}).write();
	}

	start(soc, power) {
		console.log('start logging');

		db.get('data').push({
			date: new Date(),
			curve: []
		}).write();

		this.update(soc, power);
	}

	update(soc = -1, power = -1) {
		db.get('data').last().get('curve').push({
			date: new Date(),
			soc: soc,
			power: power
		}).write();
	}

	get() {
		return db.get('data').value();
	}
}