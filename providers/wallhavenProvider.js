const Lang = imports.lang;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;
const WallpaperProvider = Self.imports.wallpaperProvider;
log('[EXTENSION_LOG]', 2222);
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
    this.settings.connect('changed', Lang.bind(this, this._applySettings));
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
        global.log('Couldn\'t get new wallpapers, reusing old.');
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
    Utils.debug('_applySettings', this.__name__);

    if (this.settingsTimer) {
      GLib.Source.remove(this.settingsTimer);
    }
    this.settingsTimer = null;

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

    if (this.settings.get_boolean('purity-nsfw')) {
      /*
      this._requestToken(Lang.bind(this, function (token) {
        this._requestLogin('user', 'pass', token, function (bool) {
          if (bool) {
            Utils.debug("SUCCESS", this.__name__);
          } else {
            Utils.debug("FAILURE", this.__name__);
          }
        });
      }));
      */
    }

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
    Utils.debug('_requestWallpapersOnPage, page: ' + page, this.__name__);
    Utils.debug('Requesting: https://alpha.wallhaven.cc/search?' + OPTIONS.toParameterString() + '&page=' + page, this.__name__);
    const request = this.session.request_http('GET',
      'https://alpha.wallhaven.cc/search?' + OPTIONS.toParameterString() + '&page=' + page);
    const message = request.get_message();

    this.session.queue_message(message, Lang.bind(this, function (session, message) {
      let ids = [];
      if (message.status_code != Soup.KnownStatusCode.OK) {
        Utils.debug('_requestWallpapersOnPage error: ' + message.status_code, this.__name__);
        if (callback) {
          callback(ids);
        }
        return;
      }

      const matches = message.response_body.data.match(/data-wallpaper-id="(\d+)"/g);
      if (matches) {
        ids = matches.map(function (elem) {
          return elem.match(/\d+/);
        });
        Utils.debug('ids: ' + ids, this.__name__);
      }

      if (callback) {
        callback(ids);
      }
    }));
  },

  _downloadWallpaper: function (id, callback) {
    Utils.debug('_downloadWallpaper: ' + id, this.__name__);
    this._requestWallpaperType(id, Lang.bind(this, function (type) {
      if (type) {
        const request = this.session.request_http('GET', 'https://wallpapers.wallhaven.cc/wallpapers/full/wallhaven-' + id + '.' + type);
        const message = request.get_message();

        const outputFile = this.dir.get_child('wallhaven-' + id + '.' + type);
        if (!outputFile.query_exists(null)) {
          const outputStream = outputFile.create(Gio.FileCreateFlags.NONE, null);

          this.session.queue_message(message, Lang.bind(this, function (session, message) {
            const contents = message.response_body.flatten().get_as_bytes();
            outputStream.write_bytes(contents, null);
            outputStream.close(null);
            Utils.debug('Downloaded: ' + id, this.__name__);
            if (callback) {
              callback(outputFile.get_parse_name());
            }
          }));
        } else {
          if (callback) {
            callback(outputFile.get_parse_name());
          }
        }
      } else {
        if (callback) {
          callback(null);
        }
      }
    }));
  },

  _requestWallpaperType: function (id, callback) {
    Utils.debug('_requestWallpaperType: ' + id, this.__name__);
    const request = this.session.request_http('GET', 'https://alpha.wallhaven.cc/wallpaper/' + id);
    const message = request.get_message();
    this.session.queue_message(message, Lang.bind(this, function (session, message) {
      if (message.status_code != Soup.KnownStatusCode.OK) {
        Utils.debug('_requestWallpaperType error: ' + message.status_code, this.__name__);
        if (callback) {
          callback(null);
        }
        return;
      }

      const type = message.response_body.data.match(/\/\/wallpapers.wallhaven.cc\/wallpapers\/full\/wallhaven-\d+.(\w+)/i)[1];
      if (callback) {
        callback(type);
      }
    }));
  },

  _requestToken: function (callback) {
    Utils.debug('_requestToken', this.__name__);
    const request = this.session.request_http('GET', 'https://alpha.wallhaven.cc/auth/login');
    const message = request.get_message();
    this.session.queue_message(message, Lang.bind(this, function (session, message) {
      let token = null;
      if (message.status_code != Soup.KnownStatusCode.OK) {
        Utils.debug('_requestToken error: ' + message.status_code, this.__name__);
        if (callback) {
          callback(token);
        }
        return;
      }

      token = message.response_body.data.match(/<input name="_token" type="hidden" value="(\w+)">/);
      if (token) {
        token = token[1];
      }
      Utils.debug('token: ' + token, this.__name__);

      if (callback) {
        callback(token);
      }
    }));
  },

  _requestLogin: function (username, password, token, callback) {
    Utils.debug('_requestLogin', this.__name__);
    const request = this.session.request_http('POST', 'https://alpha.wallhaven.cc/auth/login');
    const message = request.get_message();
    const body = '_token=' + token + '&username=' + username + '&password=' + password;
    message.set_request('multipart/form-data', Soup.MemoryUse.COPY, body);
    this.session.queue_message(message, Lang.bind(this, function (session, message) {
      if (message.status_code != Soup.KnownStatusCode.OK) {
        Utils.debug('_requestLogin error: ' + message.status_code, this.__name__);
        if (callback) {
          callback(false);
        }
        return;
      }

      Utils.debug(message.response_body.data, this.__name__);
      if (callback) {
        callback(true);
      }
    }));
  }
});