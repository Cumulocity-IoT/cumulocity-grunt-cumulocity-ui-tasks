var url = require('url'),
  path = require('path'),
  _ = require('lodash'),
  st = require('connect-static-transform'),
  httpProxy = require('http-proxy');

function setupConnect(grunt) {

  var proxy = httpProxy.createServer({target: grunt.config('cumulocity.protocol') + '://' + grunt.config('cumulocity.host')});

  function findApp(req, res, next) {
    var _path = url.parse(req.url).pathname,
      pathMatch = _path.match(/^\/apps\/(\w+)\/?/),
      appPath = pathMatch && pathMatch[1];

    req.orig_url = req.url;

    if (appPath) {
      req.appContextPath = appPath;
      req.url = req.url.replace(new RegExp('\/apps\/' + appPath + '\/?'), '/');
      if (!req.url || req.url === '/') {
        req.url = '/index.html';
      }
    }

    return next();
  }

  function bower_components(req, res, next) {
    if (req.url.match('bower_components')) {
      req.url = req.url.replace(/.*bower_components/, '/bower_components');
    }
    next();
  }

  function parseManifestData(data) {
    var app = grunt.config('localApplication'),
      plugins = grunt.config('localPlugins'),
      _data = JSON.parse(data);

    _data.imports.forEach(function (i) {
      var localP = _.find(plugins, function (p) { return Number(p.manifest._id) === Number(i.id); });
      if (localP) {
        _.merge(i, localP.manifest);
      }
    });

    return JSON.stringify(_data);
  }

  function proxyServerRequest(req, res, next) {
    var toProxy = [
        'inventory',
        'user',
        'alarm',
        'event',
        'devicecontrol',
        'measurement',
        'identity',
        'application',
        'tenant',
        'cep',
        'apps'
      ];

    req.url = req.orig_url;
    var proxied = _.any(toProxy, function (a) { return req.url.match(new RegExp('^/' + a)); });

    if (proxied && !req.pluginContextPath) {

      delete req.headers.host;

      if (req.url.match('manifest')) {
        var _write = res.write,
          out = '';
        res.write = function (data) {
          out = out + data.toString();
          try {
            JSON.parse(out);
          } catch(e) {
            return;
          }
          _write.call(res, parseManifestData(out));
        };
      }

      return proxy.web(req, res);
    } else {
      next();
    }
  }

  function pluginFiles(req, res, next) {
    var plugins = grunt.config.get('localPlugins');

    if (req.appContextPath) {
      var ctx = req.appContextPath,
        _path = url.parse(req.url).pathname,
        pluginMatch = _path.replace('/apps/' + ctx + '/', '').match(/([^\/]+)/),
        plugin = pluginMatch && pluginMatch[1],
        existing = _.find(plugins, function (p) {
          return p.contextPath === plugin;
        });

      if (plugin && existing) {
        req.pluginContextPath = plugin;
      }
    }

    next();
  }

  function mnt(connect, dir) {
    dir = grunt.template.process(dir, grunt.config);
    return connect.static(path.resolve(dir));
  }

  function mntProcess(dir, transform) {
    console.log(dir);
    return st({
      root: dir,
      match: /.+\.(js|css|html)/,
      transform: transform
    });
  }

  function placeholders(req, res, next) {
    var app = req.appContextPath,
      plugin = req.pluginContextPath;


    if (app && plugin) {
      var map = {
        ':::PLUGIN_PATH:::': ['/apps',app,plugin,''].join('/')
      },
        plugin_path = grunt.template.process('<%= paths.plugins %>', grunt.config);
      return mntProcess(plugin_path, function (path, text, send) {
        Object.keys(map).forEach(function (k) {
          text = text.replace(new RegExp(k, 'g'), map[k]);
        });
        send(text);
      })(req, res, next);
    }

    next();
  }

  function connectMidlewares(_root, connect, options) {
    var mount = _.partial(mnt, connect);
    return [
      findApp,
      pluginFiles,
      placeholders,
      bower_components,
      mount('<%= paths.temp %>'),
      mount('<%= paths.temp %>/plugins'),
      mount(_root),
      mount('<%= paths.plugins %>'),
      proxyServerRequest
    ];
  }

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.config('connect', {
    options: {
      port: 8000,
      hostname: '0.0.0.0',
      livereload: true
    },
    plugin: {
      options: {
        middleware: _.partial(connectMidlewares, 'node_modules/grunt-cumulocity-ui-tasks/lib/static')
      }
    },
    core: {
      options: {
        port: 9000,
        middleware: _.partial(connectMidlewares, '<%= paths.root %>')
      }
    }
  });
}

function readPlugins(grunt) {
  var pluginCwd = grunt.template.process('<%= paths.plugins %>', grunt.config),
    plugins = grunt.file.expand({cwd: pluginCwd}, '**/cumulocity.json')
    .map(function (_path) {
      return {
        contextPath: _path.replace('/cumulocity.json', ''),
        manifest: grunt.file.readJSON(pluginCwd + '/' + _path)
      };
    });

  grunt.log.subhead(plugins.length  + ' plugins detected');
  grunt.log.oklns(_.pluck(plugins, 'contextPath').join(' , '));
  grunt.config('localPlugins', plugins);
}

function readApplication(grunt) {
  var app = grunt.file.readJSON('cumulocity.json');
  grunt.log.subhead('Application /apps/' + app.contextPath);
  grunt.log.oklns(app.name);
  grunt.config('localApplication', app);
}

function setupWatch(grunt) {
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.config('watch', {
    options: {
      livereload: true
    },
    // grunt: {
    //   files: ['Gruntfile.js', 'tasks/*.js', 'tasks/**/*.js'],
    //   tasks: ['connect:server']
    // },
    manifests: {
      files: ['cumulocity.json', '**/cumulocity.json'],
      tasks: ['readApplication', 'readPlugins']
    }
  });
}

module.exports = function (grunt) {
  'use strict';

  grunt.registerTask('readPlugins', _.partial(readPlugins, grunt));
  grunt.registerTask('readApplication', _.partial(readApplication, grunt));

  setupConnect(grunt);
  setupWatch(grunt);

};
