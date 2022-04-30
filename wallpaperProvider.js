const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Signals = imports.signals;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;

var Provider = class {
	static get name() { return "Provider Base"; }

	constructor() {
		Signals.addSignalMethods(this);
		Utils.debug('_init', this.constructor.name);
		this.currentWallpaper = null;
		this.wallpapers = [];
	}

	next(callback) {
		Utils.debug('next', this.constructor.name);
		function notCurrent(file) {
			return file !== this.currentWallpaper;
		}

		if(this.wallpapers.length > 1) {
			const index = Math.floor(Math.random() * (this.wallpapers.length - 1));
			this.currentWallpaper = this.wallpapers.filter((file) => {return file !== this.currentWallpaper;})[index];
		} else {
			this.currentWallpaper = this.wallpapers[0];
		}

		Utils.debug('next' + this.currentWallpaper, this.constructor.name);
		if(callback) {
			callback(this.currentWallpaper);
		}
	}

	get() {
		Utils.debug('get', this.constructor.name);
		return this.currentWallpaper;
	}

	getPreferences() {
		Utils.debug('getPreferences', this.constructor.name);
		let prefs = Self.dir.get_path() + '/preferences/' + this.constructor.name.toLowerCase() + '.xml';
		let prefsFile = Gio.File.new_for_path(prefs);
		if(!prefsFile.query_exists(null)) {
			prefs = Self.dir.get_path() + '/preferences/provider.xml';
		}
		const builder = Gtk.Builder.new_from_file(prefs);
		return builder;
	}

	destroy() {
		Utils.debug('destroy', this.constructor.name);
	}
};