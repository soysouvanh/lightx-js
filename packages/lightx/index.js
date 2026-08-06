const dao = require('daox');
const template = require('tmplx');

class LightX {
  run() {
    dao.query("SELECT * FROM users");
    template.render("index.html");
  }
}

new LightX().run();