const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Util = imports.misc.util;
const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;

const TIMER = {
	minutes: 0,
	hours: 0,
	running: true,

	toSeconds: function() {
		return this.minutes * 60 + this.hours * 3600
	}
}

let panelEntry;

class WallpaperChangerEntry extends PanelMenu.Button {
	static {
		GObject.registerClass(this);
	}

	constructor() {
		super(0, 'WallpaperChangerEntry');

		this.settings = Utils.getSettings();
		this.settings.connect('changed::minutes', this.applyTimer);
		this.settings.connect('changed::hours', this.applyTimer);
		this.settings.connect('changed::provider', this.applyProvider);

		this.settings.connect('changed::debug', function() {
			Utils.DEBUG = this.settings.get_boolean('debug');
		});
		Utils.DEBUG = this.settings.get_boolean('debug');
		Utils.debug('_init', this.__name__);

		this.applyProvider();
		this.applyTimer();

		const icon = new St.Icon({
			icon_name: 'preferences-desktop-wallpaper-symbolic',
			style_class: 'system-status-icon'
		});
		this.actor.add_child(icon);

		// Construct items
		const nextItem = new PopupMenu.PopupMenuItem('Next Wallpaper');
		const settingsItem = new PopupMenu.PopupMenuItem('Settings');
		const separatorItem = new PopupMenu.PopupSeparatorMenuItem('');
		const pauseItem = new PopupMenu.PopupMenuItem('Pause');

		// Add items to menu
		this.menu.addMenuItem(nextItem);
		this.menu.addMenuItem(pauseItem);
		this.menu.addMenuItem(separatorItem);
		this.menu.addMenuItem(settingsItem);

		// Bind events
		settingsItem.connect('activate', () => {this.openSettings();});
		nextItem.connect('activate', () => {this.nextWallpaper();});
		pauseItem.connect('activate', () => {this.pauseToggle(pauseItem);});
	}

	openSettings() {
		Utils.debug('openSettings', this.__name__);
		imports.misc.extensionUtils.openPrefs();
	}

	nextWallpaper() {
		this.provider.next((path) => {this.setWallpaper(path);});
		this.resetTimer();
	}

	pauseToggle(pauseItem) {
		return function() {
			TIMER.running = !TIMER.running;
			Utils.debug('pause - timer running = ' + TIMER.running);
			pauseItem.label.set_text(TIMER.running ? 'Pause' : 'Unpause');
			this.resetTimer();
		}
	}

	applyProvider() {
		Utils.debug('applyProvider', this.__name__);
		this.provider = Utils.getProvider(this.settings.get_string('provider'));
		this.nextWallpaper();
		this.provider.connect('wallpapers-changed', function(provider) {
			if(provider === this.provider) {
				Utils.debug('wallpapers-changed signal received', this.__name__);
				this.nextWallpaper();
			}
		});
	}

	applyTimer() {
		Utils.debug('applyTimer', this.__name__);
		TIMER.minutes = this.settings.get_int('minutes');
		TIMER.hours = this.settings.get_int('hours');

		this.resetTimer();
	}

	resetTimer() {
		Utils.debug('resetTimer', this.__name__);
		if(this.timer) {
			GLib.Source.remove(this.timer);
		}

		if(TIMER.running && TIMER.toSeconds() > 0) {
			Utils.debug('Set to ' + TIMER.toSeconds(), this.__name__);
			this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
				TIMER.toSeconds(),
				() => {
					this.timer = null;
					this.nextWallpaper();
					return false;
				}
			);
		} else {
			this.timer = null;
		}
	}

	setWallpaper(path) {
		Utils.debug('setWallpaper', this.__name__);
		const scaled = this.settings.get_boolean('scaled')
		const background_setting = new Gio.Settings({ schema: 'org.gnome.desktop.background' });

		if(scaled && background_setting.is_writable('picture-options')) {
			background_setting.set_string('picture-options', 'scaled');
		}
		if(background_setting.is_writable('picture-uri')) {
			if(background_setting.set_string('picture-uri', 'file://' + path)) {
				Utils.debug(path, this.__name__);
				Gio.Settings.sync();
			} else {
				Utils.debug('Unable to set wallpaper', this.__name__)
			}
		} else {
			Utils.debug('Can\'t write to org.gnome.desktop.background', this.__name__);
		}
	}
};

function init() {
}

function enable() {
	panelEntry = new WallpaperChangerEntry();
	Main.panel.addToStatusArea('wallpaper-changer-menu', panelEntry);
}

function disable() {
	GLib.Source.remove(panelEntry.timer);
	panelEntry.destroy();
	panelEntry = null;
}


