var _ = require('lodash'),
  path = require('path');

function task(grunt) {

  var CORE_CONFIG_FILE = 'core.config.json',
    CORE_FOLDER = 'cumulocity-ui',
    PATH_OBJ = getCorePath(),
    APP_FOLDER = 'app/';

  function getCorePath() {
    var coreConfigFile = CORE_CONFIG_FILE,
      coreFolder = CORE_FOLDER,
      isCore = grunt.file.exists(coreConfigFile),
      hasCoreSibling = !isCore && grunt.file.exists('..', coreFolder, coreConfigFile),
      filePath = isCore ? coreConfigFile :
        (hasCoreSibling ? path.join('..', coreFolder, coreConfigFile) : null);

    return {
      path: filePath,
      isCore: isCore,
      hasCoreSibling: hasCoreSibling
    };
  }

  function getCoreConfig() {
    var path_data = PATH_OBJ;
      config = path_data.path ? grunt.file.readJSON(path_data.path) : null;
    return config;
  }

  function filterType(arr, type) {
    return _.chain(arr)
      .map(function (f) {
        return f[type] || ((type === 'local') ? f : null);
      })
      .filter(_.identity)
      .map(function (f) {
        if (f.match(/^scripts/) || f.match(/^bower_components/)) {
          f = APP_FOLDER + f;
        }

        if (PATH_OBJ.hasCoreSibling) {
          f = '../' + CORE_FOLDER + '/' + f;
        }
        return f;
      })
      .value();
  }


  grunt.task.registerTask('core-config', function () {
    var config = grunt.config('coreconfig');

    if (!config) {
      config = {};
      var rawcfg = config.raw = getCoreConfig();

      if (rawcfg) {
        config = _.extend(config, {
          cssvendor: function () {
            return filterType(this.raw.cssfiles.vendor, 'local');
          },

          cssui: function () {
            return filterType(this.raw.cssfiles.ui, 'local');
          },

          css: function () {
            return _.union(this.cssvendor(), this.cssui());
          },

          jsvendor: function () {
            return filterType(this.raw.jsfiles.vendor, 'local');
          },

          jscore: function () {
            return filterType(this.raw.jsfiles.core, 'local');
          },

          jsui: function () {
            return filterType(this.raw.jsfiles.ui, 'local');
          },

          js: function () {
            return _.union(this.jsvendor(), this.jscore(), this.jsui());
          },

          jstest: function () {
            return _.union(this.jsvendor(), this.jscore(), this.jsui(),
                filterType(this.raw.jsfiles.vendortest, 'local'),
                filterType(this.raw.jsfiles.test, 'local'));
          }
        });

        config._jstest = config.jstest();
      }

      grunt.config('coreconfig', config);
    }

  });
}

module.exports = task;