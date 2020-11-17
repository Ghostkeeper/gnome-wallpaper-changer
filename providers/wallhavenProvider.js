const Lang = imports.lang;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;
const WallpaperProvider = Self.imports.wallpaperProvider;
const SETTINGS_DELAY = 5;

const OPTIONS = {
  query: '',
  categories: '100',
  purity: '100',
  resolution: '',
  ratio: '16x9',
  sorting: 'random',
  order: 'desc',

  toParameterString: function () {
    return 'categories=' + this.categories
      + '&purity=' + this.purity
      + '&resolutions=' + this.resolution
      + '&ratios=' + this.ratio
      + '&sorting=' + this.sorting
      + '&order=' + this.order
      + '&q=' + this.query;
  }
}

const Provider = new Lang.Class({
  Name: 'Wallhaven',
  Extends: WallpaperProvider.Provider,
  wallpapers: [],

  _init: function () {
    this.parent();
    this.page = 0;
    this.dir = Utils.makeDirectory(Self.path + '/' + this.__name__);
    this.wallpapers = Utils.getFolderWallpapers(this.dir);

    this.session = new Soup.Session();
    const cookiejar = new Soup.CookieJarDB({ filename: this.dir.get_child('cookies.sql').get_parse_name() });
    Soup.Session.prototype.add_feature.call(this.session, cookiejar);

    this.settings = Utils.getSettings(this);
    this.extensionSettings = Utils.getSettings();
    this.settings.connect('changed', Lang.bind(this, this._applySettings));
    this.extensionSettings.connect('changed', Lang.bind(this, this._applySettings));
    this._applySettings();
  },

  next: function (callback, parent) {
    Utils.debug('next - parent?' + parent, this.__name__);
    if (parent) {
      this.parent(callback);
      return;
    }
    const newWallpaper = Lang.bind(this, function () {
      Utils.debug('newWallpaper', this.__name__);
      this.next(callback, true);

      this.wallpapers = this.wallpapers.filter(Lang.bind(this, function (w) {
        return this.currentWallpaper !== w;
      }));
    });

    let called = false;
    const oldWallpapers = Utils.getFolderWallpapers(this.dir);

    function download(id) {
      this._downloadWallpaper(id, Lang.bind(this, function (path) {
        Utils.debug('_downloadWallpaper callback: ' + path, this.__name__);
        if (path) {
          if (!called) {
            Utils.debug('first call', this.__name__);
            called = true;
            this.currentWallpaper = path;
            callback(this.currentWallpaper);

            oldWallpapers.forEach(Lang.bind(this, function (wallpaper) {
              this._deleteWallpaper(wallpaper);
            }));
          } else {
            Utils.debug('adding', this.__name__);
            this.wallpapers.push(path);
          }
        }
      }));
    }

    function downloadAll(ids) {
      if (ids.length > 0) {
        Utils.debug('new ids: ' + ids.length, this.__name__);
        ids.forEach(Lang.bind(this, download));
      } else if (this.page > 1) {
        Utils.debug('trying page 0', this.__name__);
        this.page = 0;
        this.next(callback);
      } else {
        Utils.debug('Couldn\'t get new wallpapers, reusing old.');
        this.wallpapers = oldWallpapers;
        newWallpaper();
      }
    }

    if (this.wallpapers.length === 0) {
      Utils.debug('get new wallpapers', this.__name__);
      this._requestWallpapersOnPage(++this.page, Lang.bind(this, downloadAll));
    } else {
      newWallpaper()
    }
  },

  getPreferences: function () {
    const prefs = this.parent();

    this.settings.bind('query', prefs.get_object('field_query'), 'text', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('token', prefs.get_object('field_token'), 'text', Gio.SettingsBindFlags.DEFAULT);

    this.settings.bind('category-general', prefs.get_object('field_general'), 'active', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('category-anime', prefs.get_object('field_anime'), 'active', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('category-people', prefs.get_object('field_people'), 'active', Gio.SettingsBindFlags.DEFAULT);

    this.settings.bind('purity-sfw', prefs.get_object('field_sfw'), 'active', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('purity-sketchy', prefs.get_object('field_sketchy'), 'active', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('purity-nsfw', prefs.get_object('field_nsfw'), 'active', Gio.SettingsBindFlags.DEFAULT);

    this.settings.bind('resolution', prefs.get_object('field_resolution'), 'active-id', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('ratio', prefs.get_object('field_ratio'), 'active-id', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('sorting', prefs.get_object('field_sorting'), 'active-id', Gio.SettingsBindFlags.DEFAULT);
    this.settings.bind('order', prefs.get_object('field_order'), 'active-id', Gio.SettingsBindFlags.DEFAULT);

    return prefs;
  },

  destroy: function () {
    this.parent();
    this.session.abort();
  },

  _applySettings: function () {
    if (this.settingsTimer) {
      GLib.Source.remove(this.settingsTimer);
    }
    this.settingsTimer = null;

    const monitors = this.extensionSettings.get_int('monitors') || 1;

    Utils.debug('_applySettings monitor count: ' + monitors, this.__name__)

    OPTIONS.monitors = monitors;

    OPTIONS.query = this.settings.get_string('query').replace(/ /g, '+');

    OPTIONS.categories = (this.settings.get_boolean('category-general') ? '1' : '0')
      + (this.settings.get_boolean('category-anime') ? '1' : '0')
      + (this.settings.get_boolean('category-people') ? '1' : '0');

    OPTIONS.purity = (this.settings.get_boolean('purity-sfw') ? '1' : '0')
      + (this.settings.get_boolean('purity-sketchy') ? '1' : '0')
      + (this.settings.get_boolean('purity-nsfw') ? '1' : '0');

    OPTIONS.resolution = this.settings.get_string('resolution');
    OPTIONS.ratio = this.settings.get_string('ratio');
    OPTIONS.sorting = this.settings.get_string('sorting');
    OPTIONS.order = this.settings.get_string('order');

    this.settingsTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
      SETTINGS_DELAY,
      Lang.bind(this, function () {
        this._resetWallpapers();
        return false;
      })
    );
  },

  _resetWallpapers: function () {
    Utils.debug('_resetWallpapers', this.__name__);
    this.page = 0;
    this.wallpapers = [];
    this.emit('wallpapers-changed', this);
  },

  _deleteWallpaper: function (wallpaper) {
    Utils.debug('_deleteWallpaper ' + wallpaper, this.__name__);
    if (this.currentWallpaper !== wallpaper) {
      Utils.debug('Deleting... ', this.__name__);
      Gio.File.new_for_path(wallpaper).delete_async(GLib.PRIORITY_DEFAULT, null,
        Lang.bind(this, function (file, res) {
          try {
            file.delete_finish(res);
          } catch (e) {
            Utils.debug(e, this.__name__);
          }
        }));
    }
  },

  _requestWallpapersOnPage: function (page, callback, no_match_callback) {
    Utils.debug('_requestWallpapersOnPage: ' + page, this.__name__);
    const params = `${OPTIONS.toParameterString()}&page=${page}&apikey=${this.settings.get_string('token')}`
    const request = this.session.request_http(
      'GET',
      `https://wallhaven.cc/api/v1/search?${params}`
    );
    const message = request.get_message();
    Utils.debug('_requestWallpapersOnPage: ' + params, this.__name__)

    this.session.queue_message(message, Lang.bind(this, function (session, message) {
      let paths = [];
      if (message.status_code != Soup.KnownStatusCode.OK) {
        Utils.debug('_requestWallpapersOnPage error: ' + message.status_code, this.__name__);
        if (callback) {
          callback(paths);
        }
        return;
      }

      const response = JSON.parse(message.response_body.data)
      response.data.filter(function(item) {
        paths.push(item.path)
      })

      if (callback) {
        callback(paths);
      }
    }));
  },

  _downloadWallpaper: function (path, callback) {
    Utils.debug('_downloadWallpaper: ' + path, this.__name__);
    try {
      const request = this.session.request_http('GET', path);
      const message = request.get_message();
      const outputFile = this.dir.get_child(path.match(/wallhaven-.*/)[0]);

      if (!outputFile.query_exists(null)) {
        const outputStream = outputFile.create(Gio.FileCreateFlags.NONE, null);

        this.session.queue_message(message, Lang.bind(this, function (session, message) {
          const contents = message.response_body.flatten().get_as_bytes();
          outputStream.write_bytes(contents, null);
          outputStream.close(null);
          Utils.debug('Downloaded: ' + path, this.__name__);
          if (callback) {
            callback(outputFile.get_parse_name());
          }
        }));
      } else {
        if (callback) {
          callback(outputFile.get_parse_name());
        }
      }
    } catch (e) {
      Utils.debug(e)
    }
  },
});