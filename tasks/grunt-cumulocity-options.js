module.exports = function (grunt) {
  'use strict';

  var branding = grunt.option('branding'),
    target = grunt.option('target');

  function processBranding() {
    if (!grunt.config('instance.branding')) {
      grunt.config('instance.branding', branding);
    }
  }

  function targetPath(target) {
    return '../cumulocity-ui/deploy/targets/' + target + '.json';
  }

  function processTarget() {
    var coreExists = grunt.config('coreconfig');

    if (target && coreExists) {
      var path = targetPath(target),
        fileExists = grunt.file.exists(path);

      if (!fileExists) {
        return grunt.log.error('Deploy target ' + target + ' not found.');
      }

      var targetObj = grunt.file.readJSON(path);
      grunt.config('instance', targetObj.options || {});
    }
  }

  grunt.registerTask('c8y-instance-options', function () {
    processTarget();
    processBranding();
  });

};
