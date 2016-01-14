/**
 * Google Analytics integration with a Sencha plugin
 *
 * @version     1.0
 * @license     MIT License
 * @author      Diogenes Firmiano
 *
 * Original Work from Pokki team :
 *              Blake Machado <blake@sweetlabs.com>, SweetLabs, Inc.
 *              Fontaine Shu <fontaine@sweetlabs.com>, SweetLabs, Inc.
 * see this repository : https://github.com/blakemachado/Pokki
 *
 * Example usage:
 *
 * - Place these two lines with your values in a script tag in the head of index.html
 *   mba_ga.initialize('--GA-ACCOUNT-ID--');
 *   mbaGA.trackPageview('/index.html');
 *
 * - Call these whenever you want to track a page view or a custom event
 *   mbaGA.trackPageview('/index', 'optional title');
 *   mbaGA.trackEvent('category', 'action', 'label', 'value');
 */

Ext.define('Mba.ux.GoogleAnalytics.GALocalStorage', {
    singleton: true,
    global: {},
    alternateClassName: 'mbaGA',

    initialize: function(account_id) {
        this.LocalStorage = function (key, initial_value) {
			if (window.localStorage.getItem(key) === null && initial_value !== null) {
				window.localStorage.setItem(key, initial_value);
			}

			this._get = function () {
				return window.localStorage.getItem(key);
			};

			this._set = function (value) {
				return window.localStorage.setItem(key, value);
			};

			this._remove = function () {
				return window.localStorage.removeItem(key);
			};

			this.toString = function () {
				return this._get();
			};
		};
		this.ga_url = 'http://www.google-analytics.com';
		this.ga_ssl_url = 'https://ssl.google-analytics.com';
		this.last_url = '/'; // used to keep track of last page view logged to pass forward to subsequent events tracked
		this.last_nav_url = '/'; // used to keep track of last page actually visited by the user (not popup_hidden or popup_blurred!)
		this.last_page_title = '-'; // used to keep track of last page view logged to pass forward to subsequent events tracked
		this.timer; // used for blur/focus state changes

		this.ga_use_ssl = false; // set by calling _enableSSL or _disableSSL
		this.utmac = false; // set by calling _setAccount
		this.utmhn = false; // set by calling _setDomain
		this.utmwv = '4.3'; // tracking api version
		this.utmcs = 'UTF-8'; // charset
		this.utmul = 'en-us'; // language
		this.utmdt = '-'; // page title
		this.utmt = 'event'; // analytics type
		this.utmhid = 0; // unique id per session

		this.event_map = {
			hidden:{
				path:'/popup_hidden',
				event:'PopupHidden'
			},
			blurred:{
				path:'/popup_blurred',
				event:'PopupBlurred'
			},
			focused:{
				path:'{last_nav_url}',
				event:'PopupFocused'
			}
		};

		this.uid = new this.LocalStorage('mba_ga_uid');
		this.uid_rand = new this.LocalStorage('mba_ga_uid_rand');
		this.session_cnt = new this.LocalStorage('mba_ga_session_cnt');
		this.f_session = new this.LocalStorage('mba_ga_f_session');
		this.l_session = new this.LocalStorage('mba_ga_l_session');

		this.c_session = 0;

		this.request_cnt = 0;
		this.IS_DEBUG = false;
		if (account_id) {
			this._setAccount(account_id);
		}
    },

	beacon_url: function() {
		return (
				this.ga_use_ssl ? this.ga_ssl_url : this.ga_url
				) + '/__utm.gif';
	},

	rand: function(min, max) {
		return min + Math.floor(Math.random() * (max - min));
	},

	get_random: function() {
		return this.rand(100000000, 999999999);
	},


	return_cookies: function(source, medium, campaign) {
		source = source || '(direct)';
		medium = medium || '(none)';
		campaign = campaign || '(direct)';

		// utma represents user, should exist for lifetime: [user_id].[random #].[first session timestamp].[last session timestamp].[start of this session timestamp].[total # of sessions]
		// utmb is a session, [user_id].[requests_per_session?].[??].[start of session timestamp]
		// utmc is a session, [user_id]
		// utmz is a referrer cookie
		var cookie = this.uid._get();
		var ret = '__utma=' + cookie + '.' + this.uid_rand._get() + '.' +
		this.f_session._get() + '.' + this.l_session._get() + '.' + this.c_session + '.' +
		this.session_cnt._get() + ';';
		ret += '+__utmz=' + cookie + '.' + this.c_session + '.1.1.utmcsr=' + source +
		'|utmccn=' + campaign + '|utmcmd=' + medium + ';';
		ret += '+__utmc=' + cookie + ';';
		ret += '+__utmb=' + cookie + '.' + this.request_cnt + '.10.' + this.c_session + ';';
		return ret;
	},

	generate_query_string: function(params) {
		var qa = [];
		for (var key in params) {
			qa.push(key + '=' + encodeURIComponent(params[key]));
		}
		return '?' + qa.join('&');
	},

	reset_session: function(c_session) {
		if (this.IS_DEBUG) console.log('resetting session');

		this.l_session._set(c_session);
		this.request_cnt = 0;
		this.utmhid = this.get_random();
	},

	gainit: function() {
		this.c_session = (new Date()).getTime();
		if (this.IS_DEBUG) console.log('gainit', this.c_session);

		this.request_cnt = 0;
		this.utmhid = this.get_random();

		if (this.uid._get() === null || this.uid._get() === 'undefined' || this.uid._get() === 'NaN') {
			this.uid._set(this.rand(10000000, 99999999));
			this.uid_rand._set(this.rand(1000000000, 2147483647));
		}

		if (this.session_cnt._get() === null || this.session_cnt._get() === 'undefined' || this.session_cnt._get() === 'NaN') {
			this.session_cnt._set(1);
		}
		else {
			this.session_cnt._set(parseInt(this.session_cnt._get()) + 1);
		}

		if (this.f_session._get() === null || this.f_session._get() === 'undefined' || this.f_session._get() === 'NaN') {
			this.f_session._set(this.c_session);
		}
		if (this.l_session._get() === null || this.l_session._get() === 'undefined' || this.l_session._get() === 'NaN') {
			this.l_session._set(this.c_session);
		}

	},

	// public
	_enableSSL: function () {
		if (this.IS_DEBUG) console.log('Enabling SSL');
		this.ga_use_ssl = true;
	},

	// public
	_disableSSL: function () {
		if (this.IS_DEBUG) console.log('Disabling SSL');
		this.ga_use_ssl = false;
	},

	// public
	_setAccount: function (account_id) {
		if (this.IS_DEBUG) console.log(account_id);
		this.utmac = account_id;
		this.gainit();
	},
	// public
	_setDomain: function (domain) {
		if (this.IS_DEBUG) console.log(domain);
		this.utmhn = domain;
	},
	// public
	_setLocale: function (lng, country) {
		this.lng = (typeof lng === 'string' && lng.match(/^[a-z][a-z]$/i)) ? lng.toLowerCase() : 'en';
		this.country = (typeof country === 'string' && country.match(/^[a-z][a-z]$/i)) ? country.toLowerCase() : 'us';
		this.utmul = lng + '-' + country;
		if (this.IS_DEBUG) console.log(this.utmul);
	},


	// public
	trackPageview: function (path, title, source, medium, campaign) {
		if (this.IS_DEBUG) {
			console.log('Track Page View', arguments);
		}

		clearTimeout(this.timer);

		this.request_cnt++;
		if (!path) {
			path = '/';
		}
		if (!title) {
			title = this.utmdt;
		}

		// custom vars
		var event = '';


		// remember page path and title for event tracking
		this.last_url = path;
		this.last_page_title = title;
		if ([this.event_map.hidden.path, this.event_map.blurred.path].indexOf(path) < 0) {
			this.last_nav_url = path;
		}

		var params = {
			utmwv:this.utmwv,
			utmn:this.get_random(),
			utmhn:this.utmhn,
			utmcs:this.utmcs,
			utmul:this.utmul,
			utmdt:title,
			utmhid:this.utmhid,
			utmp:path,
			utmac:this.utmac,
			utmcc:this.return_cookies(source, medium, campaign)
		};
		if (event !== '') {
			params.utme = event;
		}

		var url = this.beacon_url() + this.generate_query_string(params);
		var img = new Image();
		img.src = url;
	},

	// public
	trackEvent: function (category, action, label, value, source, medium, campaign) {
		if (this.IS_DEBUG) {
			console.log('Track Event', arguments);
		}

		this.request_cnt++;
		var event = '5(' + category + '*' + action;
		if (label) {
			event += '*' + label + ')';
		}
		else {
			event += ')';
		}
		if (value) {
			event += '(' + value + ')';
		}

		var params = {
			utmwv:this.utmwv,
			utmn:this.get_random(),
			utmhn:this.utmhn,
			utmcs:this.utmcs,
			utmul:this.utmul,
			utmt:this.utmt,
			utme:event,
			utmhid:this.utmhid,
			utmdt:this.last_page_title,
			utmp:this.last_url,
			utmac:this.utmac,
			utmcc:this.return_cookies(source, medium, campaign)
		};
		var url = this.beacon_url() + this.generate_query_string(params);
		var img = new Image();
		img.src = url;
	}

});
