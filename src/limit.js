const storage = require('node-persist');

module.exports = class Limit {
	constructor() {
		storage.init();
		this._limit;
	}

	async load() {
		this._limit = await storage.get('limit');
	}

	get() {
		return this._limit;
	}

	async set(newLimit) {
		this._limit = parseInt(newLimit);
		await storage.set('limit', parseInt(newLimit));
	}
}