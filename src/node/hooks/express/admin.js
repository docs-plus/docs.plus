var eejs = require('app/src/node/eejs');

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.get('/admin', function(req, res) {
    if('/' != req.path[req.path.length-1]) return res.redirect('./admin/');
    res.send( eejs.require("app/src/templates/admin/index.html", {}) );
  });
}

