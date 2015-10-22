var nunjucks = require('nunjucks'),
  _ = require('lodash');

nunjucks.configure(__dirname + '/../views/');

function render(context) {
  return nunjucks.render('index.html', context);
}

module.exports = {
  render: render
};
