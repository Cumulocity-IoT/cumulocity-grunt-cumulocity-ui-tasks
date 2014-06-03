var _ = require('lodash');

function getPlugin(grunt, _plugin) {
  var plugins = grunt.config('localPlugins');

  if (!plugins) {
    grunt.task.run('readPlugins');
    return;
  }

  var plugin = _.where(plugins, {contextPath: _plugin})[0];
  if (!plugin) {
    grunt.fail.fatal('Plugin not found: ' + _plugin);
  }
  return plugin;
}

function pluginNeedsPrepocessor(p) {
  return !!p.manifest.less;
}

function preProcess(grunt, _plugin) {
  if (_plugin === 'all') {
      grunt.config('localPlugins')
        .filter(pluginNeedsPrepocessor)
        .forEach(function (p) {
          grunt.task.run('pluginPre:' + p.contextPath);
        });
    return;
  }

  var plugin = getPlugin(grunt, _plugin),
    tasks = [];

  if (!plugin) {
    grunt.task.run('pluginPre:' + _plugin);
    return;
  }

  var manifest = plugin.manifest,
    pluginPath = '<%= paths.plugins %>/' + _plugin + '/';

  if (manifest.less) {
    var task = 'less.plugin_' + _plugin;
    grunt.config(task, {
      files : [
        {
          src: manifest.less.map(function (f) {
            return  pluginPath + f;
          }),
          dest: '<%= paths.temp %>/plugins/' + _plugin + '/style-less.css'
        }
      ]
    });
    grunt.config('watch.plugin_' + _plugin, {
      files: [pluginPath + '**/*.less', pluginPath + '*.less'],
      tasks: [task]
    });
    tasks.push('less:plugin_' + _plugin);
  }

  if (tasks.length) {
    tasks.forEach(function (t) {
      grunt.task.run(t);
    });
  } else {
    grunt.log.ok('Nothing to do..');
  }
}

function buildPlugin(grunt, _plugin) {
  if (_plugin === 'all') {
      grunt.config('localPlugins')
        .forEach(function (p) {
          grunt.task.run('pluginBuild:' + p.contextPath);
        });
    return;
  }


  var plugin = _.find(grunt.config('localPlugins'), function (p) {
      return p.contextPath === _plugin;
    }),
    tasks = [],
    hasLess = false;

  if (!plugin) {
    grunt.fail.fatal('Plugin not found: ' + _plugin);
  }

  plugin = plugin.manifest;

  if (plugin.js) {
    var jsFileList = plugin.js.map(function (f) {
        var isBower = f.match('bower_components');
        return isBower ? '<%= paths.root %>/' + f : '<%= paths.plugins %>/' + _plugin + '/' + f;
      }),
      cfg = {
        files: [
          {
            dest: '<%= paths.build %>/' + _plugin + '/main.js',
            src: jsFileList
          }
        ]
      },
      task = ['uglify', 'plugin_' + _plugin];
    grunt.config(task.join('.'), cfg);
    tasks.push(task.join(':'));
  }

  if (plugin.less) {
    grunt.config('less.plugin_' + _plugin, {
      files : [
        {
          src: plugin.less.map(function (f) {
            var isBower = f.match('bower_components');
            return isBower ? '<%= paths.root %>/' + f : '<%= paths.plugins %>/' + _plugin + '/' + f;
          }),
          dest: '<%= paths.temp %>/plugins/' + _plugin + '/style-less.css'
        }
      ]
    });
    tasks.push('less:plugin_' + _plugin);
    hasLess = true;
  }

  if (plugin.css || hasLess) {
    var cssFileList = plugin.css ? plugin.css.map(function (f) {
        var isBower = f.match('bower_components');
        return isBower ? '<%= paths.root %>/' + f : '<%= paths.plugins %>/' + _plugin + '/' + f;
      }) : [],
      css_cfg = {
        files: [
          {
            dest: '<%= paths.build %>/' + _plugin + '/main.js',
            src: cssFileList
          }
        ]
      },
      css_task = ['cssmin', 'plugin_' + _plugin];
    if (hasLess) {

      cssFileList.push('<%= paths.temp %>/plugins/' + _plugin + '/style-less.css');
    }
    grunt.config(css_task.join('.'), css_cfg);
    tasks.push(css_task.join(':'));
  }

  if (tasks.length) {
    tasks.forEach(function (t) {
      grunt.task.run(t);
    });
  } else {
    grunt.log.ok('Nothing to do');
  }
}


module.exports = function (grunt) {
  'use strict';

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  grunt.registerTask('pluginPre', 'Preprocesses a plugin', _.partial(preProcess, grunt));
  grunt.registerTask('pluginBuild', 'Builds a plugin for deployment', _.partial(buildPlugin, grunt));

  grunt.registerTask('pluginPreAll', [
    'readPlugins',
    'pluginPre:all'
  ]);

  grunt.registerTask('pluginBuildAll', [
    'readPlugins',
    'pluginBuild:all'
  ]);
};
